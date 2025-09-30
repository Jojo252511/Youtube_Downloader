// src/downloader.ts

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import play from 'play-dl';
import crypto from 'crypto';
import NodeID3 from 'node-id3';
import { get } from 'https';
import { WebSocket } from 'ws';
import { StatusMessage } from './types';

const downloadsPath = path.join(__dirname, '..', 'downloads');
const dbPath = path.join(__dirname, '..', 'db.json');

// --- Hilfsfunktionen ---

const sendStatus = (ws: WebSocket, statusData: StatusMessage) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(statusData));
  }
};

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:\*\?"<>\|]/g, '');
}

function downloadImage(url: string, filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
            }
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .on('close', () => resolve());
            } else {
                reject(new Error(`Server-Antwort beim Bild-Download: ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

const updateDb = async (newEntry: object) => {
    const dbData = await fs.promises.readFile(dbPath, 'utf-8').catch(() => '{}');
    const db = JSON.parse(dbData);
    Object.assign(db, newEntry);
    await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2));
};


// --- Hauptfunktionen (exportiert) ---

export async function getAvailableQualities(videoUrl: string, ws: WebSocket) {
  try {
    sendStatus(ws, { status: 'loading_formats', message: 'Lade Video-Informationen...' });
    const info = await play.video_info(videoUrl);
    
    const qualities = info.format
      .filter(format => format.qualityLabel)
      .map(format => format.qualityLabel!)
      .filter((value, index, self) => self.indexOf(value) === index && value !== null)
      .sort((a, b) => parseInt(b) - parseInt(a));

    const thumbnailUrl = info.video_details.thumbnails[info.video_details.thumbnails.length - 1].url;
    const title = info.video_details.title || 'Unbekannter Titel';
    const artist = info.video_details.channel?.name || 'Unbekannter Künstler';

    sendStatus(ws, { status: 'formats_loaded', message: 'Qualitäten geladen.', qualities, thumbnailUrl, title, artist });
  } catch (error) {
    console.error(error);
    sendStatus(ws, { status: 'error', message: 'Fehler beim Abrufen der Video-Informationen.' });
  }
}


export async function downloadFile(videoUrl: string, formatType: 'mp3' | 'mp4', qualityLabel: string, ws: WebSocket) {
  try {
    sendStatus(ws, { status: 'info', message: 'Lade Video-Informationen...' });
    const info = await play.video_info(videoUrl);
    const title = info.video_details.title || 'Unbekannter Titel';
    const artist = info.video_details.channel?.name || 'Unbekannter Künstler';
    const thumbnailUrl = info.video_details.thumbnails[info.video_details.thumbnails.length - 1].url;

    const sanitizedTitle = sanitizeFilename(title);
    
    if (formatType === 'mp3') {
      const finalFileName = `${sanitizedTitle}.mp3`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempAudioPath = path.join(__dirname, `${Date.now()}_audio.tmp`);
      const tempImagePath = path.join(__dirname, `${Date.now()}_thumb.jpg`);

      sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream für MP3...' });
      
      // KORREKTUR 1/2: mime_type zu mimeType
      const bestAudio = info.format.filter(f => f.mimeType?.startsWith('audio/')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      const audioStreamData = await play.stream(videoUrl, { quality: bestAudio?.itag });

      await new Promise<void>((resolve, reject) => {
          audioStreamData.stream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', () => resolve()).on('error', reject);
      });

      sendStatus(ws, { status: 'downloading_thumb', message: 'Lade Thumbnail...' });
      await downloadImage(thumbnailUrl, tempImagePath);

      sendStatus(ws, { status: 'merging', message: 'Konvertiere zu MP3...' });
      let heartbeat = setInterval(() => sendStatus(ws, { status: 'merging', message: 'Konvertiere zu MP3...' }), 3000);

      try {
        const ffmpegCommand = `ffmpeg -i "${tempAudioPath}" -b:a 192k "${outputFilePath}"`;
        await new Promise<void>((resolve, reject) => exec(ffmpegCommand, (err) => (err ? reject(err) : resolve())));
      } finally {
        clearInterval(heartbeat);
      }
  
      const tags: NodeID3.Tags = { title, artist, image: tempImagePath };
      await NodeID3.write(tags, outputFilePath);

      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP3-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });

      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);

    } else { // MP4 Download
      const finalFileName = `${sanitizedTitle}_${qualityLabel}.mp4`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempVideoPath = path.join(__dirname, `${Date.now()}_video.tmp`);
      const tempAudioPath = path.join(__dirname, `${Date.now()}_audio.tmp`);

      sendStatus(ws, { status: 'downloading_video', message: `Lade Video-Stream in ${qualityLabel}...` });
      const videoInfoForFormat = info.format.find(f => f.qualityLabel === qualityLabel);
      const videoStreamData = await play.stream(videoUrl, { quality: videoInfoForFormat?.itag });
      await new Promise<void>((resolve, reject) => videoStreamData.stream.pipe(fs.createWriteStream(tempVideoPath)).on('finish', () => resolve()).on('error', reject));

      sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream...' });
      
      // KORREKTUR 2/2: mime_type zu mimeType
      const bestAudio = info.format.filter(f => f.mimeType?.startsWith('audio/')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      const audioStreamData = await play.stream(videoUrl, { quality: bestAudio?.itag });
      await new Promise<void>((resolve, reject) => audioStreamData.stream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', () => resolve()).on('error', reject));

      sendStatus(ws, { status: 'merging', message: 'Füge Video und Audio zusammen...' });
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a aac "${outputFilePath}"`;
      await new Promise<void>((resolve, reject) => exec(ffmpegCommand, (error) => (error ? reject(error) : resolve())));
      
      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP4-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });

      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
  } catch (error: any) {
    console.error(error);
    sendStatus(ws, { status: 'error', message: `Ein Fehler ist aufgetreten: ${error.message}` });
  }
}
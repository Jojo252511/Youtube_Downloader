// src/downloader.ts

import fs from 'fs'; // KORREKTUR: Importiere das gesamte fs-Modul
import path from 'path';
import { exec } from 'child_process';
import ytdl from '@distube/ytdl-core';
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
                // Diese Funktion nutzt fs.createWriteStream, was jetzt wieder funktioniert
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
    // KORREKTUR: Greife explizit auf fs.promises zu
    const dbData = await fs.promises.readFile(dbPath, 'utf-8').catch(() => '{}');
    const db = JSON.parse(dbData);
    Object.assign(db, newEntry);
    // KORREKTUR: Greife explizit auf fs.promises zu
    await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2));
};


// --- Hauptfunktionen (exportiert) ---

export async function getAvailableQualities(videoUrl: string, ws: WebSocket) {
  try {
    sendStatus(ws, { status: 'loading_formats', message: 'Lade Video-Informationen...' });
    const info = await ytdl.getInfo(videoUrl);
    
    const qualities = info.formats
      .filter(format => format.hasVideo && format.qualityLabel)
      .map(format => format.qualityLabel)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => parseInt(b) - parseInt(a));

    const thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url;
    const title = info.videoDetails.title;
    const artist = info.videoDetails.author.name;

    sendStatus(ws, { status: 'formats_loaded', message: 'Qualitäten geladen.', qualities, thumbnailUrl, title, artist });
    
  } catch (error) {
    console.error(error);
    sendStatus(ws, { status: 'error', message: 'Fehler beim Abrufen der Video-Informationen.' });
  }
}


export async function downloadFile(videoUrl: string, formatType: 'mp3' | 'mp4', qualityLabel: string, ws: WebSocket) {
  try {
    sendStatus(ws, { status: 'info', message: 'Lade Video-Informationen...' });
    const info = await ytdl.getInfo(videoUrl);
    const title = info.videoDetails.title;
    const artist = info.videoDetails.author.name;
    const thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url;

    const sanitizedTitle = sanitizeFilename(title);
    
    if (formatType === 'mp3') {
      const finalFileName = `${sanitizedTitle}.mp3`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempAudioPath = path.join(__dirname, `${Date.now()}_audio.tmp`);
      const tempImagePath = path.join(__dirname, `${Date.now()}_thumb.jpg`);

      sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream für MP3...' });
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
      await new Promise<void>((resolve, reject) => {
          audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', () => resolve()).on('error', reject);
      });

      sendStatus(ws, { status: 'downloading_thumb', message: 'Lade Thumbnail...' });
      await downloadImage(thumbnailUrl, tempImagePath);

      sendStatus(ws, { status: 'merging', message: 'Konvertiere zu MP3...' });
      
      let heartbeat = setInterval(() => {
        console.log('Sende Konvertierungs-Heartbeat...');
        sendStatus(ws, { status: 'merging', message: 'Konvertiere zu MP3...' });
      }, 3000);

      try {
        const ffmpegCommand = `ffmpeg -i "${tempAudioPath}" -b:a 192k "${outputFilePath}"`;
        await new Promise<void>((resolve, reject) => {
            exec(ffmpegCommand, (err) => (err ? reject(err) : resolve()));
        });
      } finally {
        clearInterval(heartbeat);
      }
  
      const tags: NodeID3.Tags = { title, artist, image: tempImagePath };
      await NodeID3.write(tags, outputFilePath);
      console.log('ID3-Tags wurden geschrieben.');

      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP3-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });

      // Diese Funktionen nutzen das Haupt-fs-Modul und funktionieren jetzt wieder
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);

    } else { // MP4 Download
      const finalFileName = `${sanitizedTitle}_${qualityLabel}.mp4`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempVideoPath = path.join(__dirname, `${Date.now()}_video.tmp`);
      const tempAudioPath = path.join(__dirname, `${Date.now()}_audio.tmp`);

      sendStatus(ws, { status: 'downloading_video', message: `Lade Video-Stream in ${qualityLabel}...` });
      const videoStream = ytdl(videoUrl, { filter: f => f.qualityLabel === qualityLabel });
      await new Promise<void>((resolve, reject) => {
          videoStream.pipe(fs.createWriteStream(tempVideoPath)).on('finish', () => resolve()).on('error', reject);
      });

      sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream...' });
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
      await new Promise<void>((resolve, reject) => {
          audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', () => resolve()).on('error', reject);
      });

      sendStatus(ws, { status: 'merging', message: 'Füge Video und Audio zusammen...' });
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a aac "${outputFilePath}"`;
      await new Promise<void>((resolve, reject) => {
          exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
      });
      
      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP4-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });

      // Diese Funktionen nutzen das Haupt-fs-Modul und funktionieren jetzt wieder
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
  } catch (error: any) {
    console.error(error);
    sendStatus(ws, { status: 'error', message: `Ein Fehler ist aufgetreten: ${error.message}` });
  }
}
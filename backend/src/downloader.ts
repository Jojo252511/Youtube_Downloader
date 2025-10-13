// src/downloader.ts

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { Innertube } from 'youtubei.js';
import crypto from 'crypto';
import NodeID3 from 'node-id3';
import { get } from 'https';
import { WebSocket } from 'ws';
import { StatusMessage } from './types';

type VideoInfo = Awaited<ReturnType<Innertube['getInfo']>>;
type VideoForm = NonNullable<VideoInfo['streaming_data']>['formats'][number];

const downloadsPath = path.join(__dirname, '..', 'downloads');
const dbPath = path.join(__dirname, '..', 'db.json');

// ... (alle Hilfsfunktionen bleiben unverändert)

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
    try {
        const dbData = await fs.promises.readFile(dbPath, 'utf-8').catch(() => '{}');
        const db = JSON.parse(dbData);
        Object.assign(db, newEntry);
        await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2));
    } catch(e) {
        console.error("Fehler beim Update der DB:", e);
    }
};

export async function getAvailableQualities(info: VideoInfo, ws: WebSocket) {
    try {
      const qualities = info.streaming_data?.formats
        .filter((f: VideoForm) => f.quality_label && f.mime_type.includes('video/mp4'))
        .map((f: VideoForm) => f.quality_label)
        .filter((value, index, arr): value is string => typeof value === 'string' && arr.indexOf(value) === index)
        .sort((a: string, b: string) => parseInt(b) - parseInt(a));
        
      if (!qualities || qualities.length === 0) {
        throw new Error("Keine MP4-Formate gefunden.");
      }
  
      const thumbnailUrl = info.basic_info.thumbnail?.[0]?.url || '';
      const title = info.basic_info.title || 'Unbekannter Titel';
      const artist = info.basic_info.channel?.name || 'Unbekannter Künstler';
  
      sendStatus(ws, { status: 'formats_loaded', message: 'Qualitäten geladen.', qualities, thumbnailUrl, title, artist });
    } catch (error) {
      console.error(error);
      sendStatus(ws, { status: 'error', message: 'Fehler beim Abrufen der Video-Informationen.' });
    }
}
  
export async function downloadFile(info: VideoInfo, formatType: 'mp3' | 'mp4', qualityLabel: string, ws: WebSocket, yt: Innertube) {
    const tempFiles: string[] = [];
    const videoId = info.basic_info.id as string;
    
    try {
      const title = info.basic_info.title || 'Unbekannter Titel';
      const artist = info.basic_info.channel?.name || 'Unbekannter Künstler';
      const thumbnailUrl = info.basic_info.thumbnail?.[0]?.url || '';
      const sanitizedTitle = sanitizeFilename(title);
      const uniqueId = crypto.randomUUID();
  
      if (formatType === 'mp3') {
          const finalFileName = `${sanitizedTitle}.mp3`;
          const outputFilePath = path.join(downloadsPath, finalFileName);
          const tempImagePath = path.join(downloadsPath, `${uniqueId}_thumb.jpg`);
          tempFiles.push(tempImagePath);
          
          sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream...' });
          const stream = await yt.download(videoId, { type: 'audio', quality: 'best' });
          const tempAudioPath = path.join(downloadsPath, `${uniqueId}_audio.tmp`);
          tempFiles.push(tempAudioPath);
  
          const fileStream = fs.createWriteStream(tempAudioPath);
          for await (const chunk of stream) {
              fileStream.write(chunk);
          }
          fileStream.end();
          
          await new Promise<void>(resolve => fileStream.on('finish', () => resolve()));
          await downloadImage(thumbnailUrl, tempImagePath);
  
          sendStatus(ws, { status: 'merging', message: 'Konvertiere zu MP3...' });
          const ffmpegCommand = `ffmpeg -i "${tempAudioPath}" -i "${tempImagePath}" -map 0:a -map 1:v -c:v copy -id3v2_version 3 -metadata title="${title}" -metadata artist="${artist}" -b:a 192k "${outputFilePath}"`;
          
          await new Promise<void>((resolve, reject) => {
              exec(ffmpegCommand, (err) => {
                  if (err) return reject(new Error(`FFmpeg-Fehler: ${err.message}`));
                  const success = NodeID3.write({ title, artist, image: tempImagePath }, outputFilePath);
                  if (success instanceof Error) return reject(new Error(`NodeID3-Fehler: ${success.message}`));
                  resolve();
              });
          });
          
          await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
          sendStatus(ws, { status: 'done', message: 'MP3-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });
  
      } else { // MP4
          const finalFileName = `${sanitizedTitle}_${qualityLabel}.mp4`;
          const outputFilePath = path.join(downloadsPath, finalFileName);
          
          const tempVideoPath = path.join(downloadsPath, `${uniqueId}_video.tmp`);
          const tempAudioPath = path.join(downloadsPath, `${uniqueId}_audio.tmp`);
          tempFiles.push(tempVideoPath, tempAudioPath);
  
          sendStatus(ws, { status: 'downloading_video', message: `Lade Video (${qualityLabel})...` });
          const videoStream = await yt.download(videoId, { type: 'video', quality: qualityLabel });
          const videoFileStream = fs.createWriteStream(tempVideoPath);
          for await (const chunk of videoStream) {
              videoFileStream.write(chunk);
          }
          videoFileStream.end();
  
          sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audiospur...' });
          const audioStream = await yt.download(videoId, { type: 'audio', quality: 'best' });
          const audioFileStream = fs.createWriteStream(tempAudioPath);
          for await (const chunk of audioStream) {
              audioFileStream.write(chunk);
          }
          audioFileStream.end();
          
          await Promise.all([
              new Promise<void>(resolve => videoFileStream.on('finish', () => resolve())),
              new Promise<void>(resolve => audioFileStream.on('finish', () => resolve()))
          ]);
  
          sendStatus(ws, { status: 'merging', message: 'Füge Video und Audio zusammen...' });
          const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a aac "${outputFilePath}"`;
          await new Promise<void>((resolve, reject) => exec(ffmpegCommand, (err) => (err ? reject(err) : resolve())));
          
          await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
          sendStatus(ws, { status: 'done', message: 'MP4-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });
      }
  
    } catch (error: any) {
      console.error("Gesamtfehler in downloadFile:", error);
      sendStatus(ws, { status: 'error', message: `Ein Fehler ist aufgetreten: ${error.message}` });
    } finally {
      tempFiles.forEach(file => {
        fs.unlink(file, (err) => {
          if (err) console.error(`Fehler beim Löschen der temporären Datei ${file}:`, err);
        });
      });
    }
}
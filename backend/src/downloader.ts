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
        // KORREKTUR: Greife explizit auf fs.promises zu
        const dbData = await fs.promises.readFile(dbPath, 'utf-8').catch(() => '{}');
        const db = JSON.parse(dbData);
        Object.assign(db, newEntry);
        await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2));
    } catch(e) {
        console.error("Fehler beim Update der DB:", e);
    }
};


// --- Hauptfunktionen (exportiert) ---

export async function getAvailableQualities(videoUrl: string, ws: WebSocket) {
  try {
    sendStatus(ws, { status: 'loading_formats', message: 'Lade Video-Informationen...' });
    const info = await ytdl.getInfo(videoUrl);
    
    // KORRIGIERTE UND VEREINFACHTE LOGIK:
    // 1. Filtere zuerst die Formate, die einen gültigen qualityLabel haben
    const formatsWithLabels = info.formats.filter(
      format => format.hasVideo && format.container === 'mp4' && format.qualityLabel
    );

    // 2. Erstelle eine saubere Liste von Labels ohne Duplikate
    const uniqueLabels = [...new Set(formatsWithLabels.map(format => format.qualityLabel))];

    // 3. Sortiere diese Liste numerisch (absteigend)
    const qualities = uniqueLabels.sort((a, b) => parseInt(b) - parseInt(a));

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
  const tempFiles: string[] = [];
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
      const tempAudioPath = path.join(downloadsPath, `${Date.now()}_audio.tmp`);
      tempFiles.push(tempAudioPath);
      const tempImagePath = path.join(downloadsPath, `${Date.now()}_thumb.jpg`);
      tempFiles.push(tempImagePath);

      sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream für MP3...' });
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
      await new Promise<void>((resolve, reject) => {
          audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', resolve).on('error', reject);
      });

      await downloadImage(thumbnailUrl, tempImagePath);

      sendStatus(ws, { status: 'merging', message: 'Konvertiere zu MP3...' });
      const ffmpegCommand = `ffmpeg -i "${tempAudioPath}" -i "${tempImagePath}" -map 0:a -map 1:v -c:v copy -id3v2_version 3 -b:a 192k "${outputFilePath}"`;
      await new Promise<void>((resolve, reject) => exec(ffmpegCommand, (err) => (err ? reject(err) : resolve())));
  
      await NodeID3.write({ title, artist, image: tempImagePath }, outputFilePath);
      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP3-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });

    } else { // KORRIGIERTER MP4-DOWNLOAD
      const finalFileName = `${sanitizedTitle}_${qualityLabel}.mp4`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempVideoPath = path.join(downloadsPath, `${Date.now()}_video.tmp`);
      tempFiles.push(tempVideoPath);
      const tempAudioPath = path.join(downloadsPath, `${Date.now()}_audio.tmp`);
      tempFiles.push(tempAudioPath);
      
      const videoFormat = ytdl.chooseFormat(info.formats, { quality: qualityLabel, filter: 'videoonly' });
      if (!videoFormat) throw new Error(`Kein Videoformat für Qualität ${qualityLabel} gefunden.`);

      sendStatus(ws, { status: 'downloading_video', message: `Lade Video-Stream in ${qualityLabel}...` });
      const videoStream = ytdl(videoUrl, { format: videoFormat });
      await new Promise<void>((resolve, reject) => videoStream.pipe(fs.createWriteStream(tempVideoPath)).on('finish', resolve).on('error', reject));

      sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream...' });
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
      await new Promise<void>((resolve, reject) => audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', resolve).on('error', reject));

      sendStatus(ws, { status: 'merging', message: 'Füge Video und Audio zusammen...' });
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a aac "${outputFilePath}"`;
      await new Promise<void>((resolve, reject) => exec(ffmpegCommand, (error) => (error ? reject(error) : resolve())));
      
      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP4-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });
    }
  } catch (error: any) {
    console.error("Gesamtfehler in downloadFile:", error);
    sendStatus(ws, { status: 'error', message: `Ein Fehler ist aufgetreten: ${error.message}` });
  } finally {
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  }
}
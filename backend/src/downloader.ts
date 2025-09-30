// src/downloader.ts

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { Innertube, UniversalCache } from 'youtubei.js';
import crypto from 'crypto';
import NodeID3 from 'node-id3';
import { get } from 'https';
import { WebSocket } from 'ws';
import { StatusMessage } from './types';

const downloadsPath = path.join(__dirname, '..', 'downloads');
const dbPath = path.join(__dirname, '..', 'db.json');

// --- Globale Instanz für youtubei.js ---
// Wir erstellen sie einmal und verwenden sie wieder, um effizient zu sein.
let yt: Innertube;
(async () => {
  yt = await Innertube.create({ cache: new UniversalCache(false) });
  console.log('youtubei.js-Instanz wurde initialisiert.');
})();


// --- Hilfsfunktionen (unverändert) ---
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

// --- Hauptfunktionen (neu mit youtubei.js) ---

export async function getAvailableQualities(videoId: string, ws: WebSocket) {
  try {
    sendStatus(ws, { status: 'loading_formats', message: 'Lade Video-Informationen...' });
    const info = await yt.getInfo(videoId);

    const qualities = info.streaming_data?.formats
      .filter(f => f.quality_label && f.mime_type.includes('video/mp4'))
      .map(f => f.quality_label)
      .filter((value, index, self): value is string => typeof value === 'string' && self.indexOf(value) === index)
      .sort((a, b) => parseInt(b) - parseInt(a));
      
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


export async function downloadFile(videoId: string, formatType: 'mp3' | 'mp4', qualityLabel: string, ws: WebSocket) {
  const tempFiles: string[] = [];
  try {
    sendStatus(ws, { status: 'info', message: 'Lade Video-Informationen...' });
    const info = await yt.getInfo(videoId);
    const title = info.basic_info.title || 'Unbekannter Titel';
    const artist = info.basic_info.channel?.name || 'Unbekannter Künstler';
    const thumbnailUrl = info.basic_info.thumbnail?.[0]?.url || '';
    const sanitizedTitle = sanitizeFilename(title);

    if (formatType === 'mp3') {
      const finalFileName = `${sanitizedTitle}.mp3`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempImagePath = path.join(downloadsPath, `${Date.now()}_thumb.jpg`);
      tempFiles.push(tempImagePath);
      
      sendStatus(ws, { status: 'downloading_audio', message: 'Lade Audio-Stream für MP3...' });
      const stream = await yt.download(videoId, { type: 'audio', quality: 'best' });
      const tempAudioPath = path.join(downloadsPath, `${Date.now()}_audio.tmp`);
      tempFiles.push(tempAudioPath);

      const fileStream = fs.createWriteStream(tempAudioPath);
      for await (const chunk of stream) {
        fileStream.write(chunk);
      }
      fileStream.end();

      await downloadImage(thumbnailUrl, tempImagePath);

      sendStatus(ws, { status: 'merging', message: 'Konvertiere zu MP3...' });
      const ffmpegCommand = `ffmpeg -i "${tempAudioPath}" -i "${tempImagePath}" -map 0:a -map 1:v -c:v copy -id3v2_version 3 -b:a 192k "${outputFilePath}"`;
      await new Promise<void>((resolve, reject) => exec(ffmpegCommand, (err) => (err ? reject(err) : resolve())));

      await NodeID3.write({ title, artist, image: tempImagePath }, outputFilePath);
      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP3-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });

    } else { // MP4
      const finalFileName = `${sanitizedTitle}_${qualityLabel}.mp4`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      
      sendStatus(ws, { status: 'downloading_video', message: `Lade Video in ${qualityLabel}...` });
      const stream = await yt.download(videoId, { type: 'video+audio', quality: qualityLabel });

      const fileStream = fs.createWriteStream(outputFilePath);
      for await (const chunk of stream) {
        fileStream.write(chunk);
      }
      fileStream.end();
      
      // Warten bis der Download wirklich fertig ist
       await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });

      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus(ws, { status: 'done', message: 'MP4-Download abgeschlossen!', fileUrl: `/downloads/${uniqueId}`, uniqueId: uniqueId });
    }

  } catch (error: any) {
    console.error("Gesamtfehler in downloadFile:", error);
    sendStatus(ws, { status: 'error', message: `Ein Fehler ist aufgetreten: ${error.message}` });
  } finally {
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
}
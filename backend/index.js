const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ytdl = require('@distube/ytdl-core');
const cors = require('cors');
const crypto = require('crypto');
const { cleanupDownloads } = require('./cleanup.js');
const NodeID3 = require('node-id3');
const { get } = require('https');

const PORT = 3000;

// --- Express App und HTTP Server Setup ---
const app = express();
app.use(cors());
const server = http.createServer(app);

const downloadsPath = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath);
}
// HINWEIS: Diese Zeile dient nur noch als Fallback oder für direkten Zugriff, wenn nötig.
app.use('/downloads', express.static(downloadsPath));


// HINZUGEFÜGT: Eine neue Route, um die Downloads über ihre einzigartige ID zu verwalten.
// Dies ermöglicht saubere Links und prüft, ob der Download noch gültig ist.
app.get('/downloads/:id', async (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'db.json');
        const dbData = await fs.promises.readFile(dbPath, 'utf-8');
        const db = JSON.parse(dbData);
        
        const entry = db[req.params.id];
        if (entry) {
            const filePath = path.join(downloadsPath, entry.filename);
            // Bietet die Datei zum Download an (setzt den richtigen Dateinamen im Browser)
            res.download(filePath, entry.filename, (err) => {
              if (err) {
                // Wenn die Datei nicht gefunden wurde, obwohl sie in der DB ist
                if (!res.headersSent) {
                   res.status(404).send('Datei nicht gefunden. Möglicherweise wurde sie bereits gelöscht.');
                }
              }
            });
        } else {
            res.status(404).send('Download nicht gefunden oder abgelaufen.');
        }
    } catch (error) {
        console.error("Download-Routen-Fehler:", error);
        res.status(500).send('Serverfehler.');
    }
});


// --- WebSocket Server Setup ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Frontend verbunden via WebSocket.');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (!data.url || !ytdl.validateURL(data.url)) {
        ws.send(JSON.stringify({ status: 'error', message: 'Ungültige YouTube URL' }));
        return;
      }
      
      if (data.type === 'getFormats') {
        await getAvailableQualities(data.url, ws);
      } else if (data.type === 'download') {
        await downloadFile(data.url, data.formatType, data.quality, ws);
      }

    } catch (error) {
      console.error(error);
      ws.send(JSON.stringify({ status: 'error', message: 'Ein Server-Fehler ist aufgetreten.' }));
    }
  });

  ws.on('close', () => {
    console.log('Frontend hat die Verbindung getrennt.');
  });
});

async function getAvailableQualities(videoUrl, ws) {
  const sendStatus = (status, message, data = {}) => {
    ws.send(JSON.stringify({ status, message, ...data }));
  };
  
  try {
    sendStatus('loading_formats', 'Lade verfügbare Qualitätsstufen...');
    const info = await ytdl.getInfo(videoUrl);
    
    const qualities = info.formats
      .filter(format => format.hasVideo && format.qualityLabel)
      .map(format => format.qualityLabel)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort((a, b) => parseInt(b) - parseInt(a));

    const thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url;
    const title = info.videoDetails.title;
    const artist = info.videoDetails.author.name;

    // Sende die neuen Informationen an das Frontend
    sendStatus('formats_loaded', 'Qualitäten geladen.', { qualities, thumbnailUrl, title, artist });
    
    
  } catch (error) {
    console.error(error);
    sendStatus('error', 'Fehler beim Abrufen der Video-Informationen.');
  }
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:\*\?"<>\|]/g, '');
}

// Hilfsfunktion zum Herunterladen des Thumbnails
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .on('close', resolve);
            } else {
                reject(new Error(`Server-Antwort: ${res.statusCode}`));
            }
        });
    });
}

async function downloadFile(videoUrl, formatType, qualityLabel, ws) {
  const sendStatus = (status, message, data = {}) => ws.send(JSON.stringify({ status, message, ...data }));

  try {
    sendStatus('info', 'Lade Video-Informationen...');
    const info = await ytdl.getInfo(videoUrl);
    const title = info.videoDetails.title;
    const artist = info.videoDetails.author.name;
    const thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url;

    const sanitizedTitle = sanitizeFilename(title);
    const dbPath = path.join(__dirname, 'db.json');

    const updateDb = async (newEntry) => {
        const dbData = await fs.promises.readFile(dbPath, 'utf-8').catch(() => '{}');
        const db = JSON.parse(dbData);
        Object.assign(db, newEntry);
        await fs.promises.writeFile(dbPath, JSON.stringify(db, null, 2));
    };

    if (formatType === 'mp3') {
      const finalFileName = `${sanitizedTitle}.mp3`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempAudioPath = path.join(__dirname, `${Date.now()}_audio.tmp`);
      const tempImagePath = path.join(__dirname, `${Date.now()}_thumb.jpg`); // NEU

      sendStatus('downloading_audio', 'Lade Audio-Stream für MP3...');
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
      await new Promise((resolve, reject) => {
          audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', resolve).on('error', reject);
      });

      // Lade das Thumbnail herunter
      sendStatus('downloading_thumb', 'Lade Thumbnail...');
      await downloadImage(thumbnailUrl, tempImagePath);

      sendStatus('merging', 'Konvertiere zu MP3...');
      const ffmpegCommand = `ffmpeg -i "${tempAudioPath}" -q:a 0 "${outputFilePath}"`;
      await new Promise((resolve, reject) => {
          exec(ffmpegCommand, (err) => (err ? reject(err) : resolve()));
      });

      // Schreibe ID3-Tags in die fertige MP3
      const tags = { title, artist, image: tempImagePath };
      await NodeID3.write(tags, outputFilePath);
      console.log('ID3-Tags wurden geschrieben.');

      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus('done', 'MP3-Download abgeschlossen!', { fileUrl: `/downloads/${uniqueId}` });

      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);

    } else { // MP4 Download
      const finalFileName = `${sanitizedTitle}_${qualityLabel}.mp4`;
      const outputFilePath = path.join(downloadsPath, finalFileName);
      const tempVideoPath = path.join(__dirname, `${Date.now()}_video.tmp`);
      const tempAudioPath = path.join(__dirname, `${Date.now()}_audio.tmp`);

      sendStatus('downloading_video', `Lade Video-Stream in ${qualityLabel}...`);
      const videoStream = ytdl(videoUrl, { filter: f => f.qualityLabel === qualityLabel });
      await new Promise((resolve, reject) => {
          videoStream.pipe(fs.createWriteStream(tempVideoPath)).on('finish', resolve).on('error', reject);
      });

      sendStatus('downloading_audio', 'Lade Audio-Stream...');
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });
      await new Promise((resolve, reject) => {
          audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', resolve).on('error', reject);
      });

      sendStatus('merging', 'Füge Video und Audio zusammen...');
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a aac "${outputFilePath}"`;
      await new Promise((resolve, reject) => {
          exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
      });
      
      const uniqueId = crypto.randomUUID();
      await updateDb({ [uniqueId]: { filename: finalFileName, createdAt: Date.now() } });
      sendStatus('done', 'MP4-Download abgeschlossen!', { fileUrl: `/downloads/${uniqueId}` });

      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
  } catch (error) {
    console.error(error);
    sendStatus('error', `Ein Fehler ist aufgetreten: ${error.message}`);
  }
}

// HINZUGEFÜGT: Starte den automatischen Aufräum-Job
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Jede Stunde
console.log('Automatischer Cleanup-Job für alte Dateien ist eingerichtet.');
cleanupDownloads(); // Einmal beim Start ausführen
setInterval(cleanupDownloads, CLEANUP_INTERVAL); // Und dann jede Stunde


server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend-Server läuft auf http://localhost:${PORT} und ist im Netzwerk erreichbar.`);
});
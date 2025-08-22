const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ytdl = require('@distube/ytdl-core');
const cors = require('cors');

const PORT = 3000;

// --- Express App und HTTP Server Setup ---
const app = express();
app.use(cors());
const server = http.createServer(app);

const downloadsPath = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath);
}
app.use('/downloads', express.static(downloadsPath));

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
        // NEU: 'formatType' wird übergeben
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
      // Sortieren nach Auflösung (numerisch)
      .sort((a, b) => parseInt(b) - parseInt(a));

    sendStatus('formats_loaded', 'Qualitäten geladen.', { qualities });
    
  } catch (error) {
    console.error(error);
    sendStatus('error', 'Fehler beim Abrufen der Video-Informationen.');
  }
}

// --- Umbenannt und stark angepasst: downloadFile ---
async function downloadFile(videoUrl, formatType, qualityLabel, ws) {
  const videoId = ytdl.getVideoID(videoUrl);
  const sendStatus = (status, message, data = {}) => {
    ws.send(JSON.stringify({ status, message, ...data }));
  };

  if (formatType === 'mp3') {
    // --- Logik für MP3-Download ---
    const outputFilePath = path.join(downloadsPath, `${videoId}.mp3`);
    const tempAudioPath = path.join(__dirname, `${videoId}_audio.tmp`);

    try {
      sendStatus('downloading_audio', 'Lade Audio-Stream für MP3...');
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
      await new Promise((resolve, reject) => {
          audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', resolve).on('error', reject);
      });

      sendStatus('merging', 'Konvertiere zu MP3 mit FFmpeg...');
      // FFmpeg-Befehl zur Konvertierung in MP3 mit guter Qualität
      const ffmpegCommand = `ffmpeg -i "${tempAudioPath}" -q:a 0 "${outputFilePath}"`;
      await new Promise((resolve, reject) => {
          exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
      });

      const finalFileName = path.basename(outputFilePath);
      sendStatus('done', 'MP3-Download abgeschlossen!', { fileUrl: `/downloads/${finalFileName}` });

    } catch (error) {
      console.error(error);
      sendStatus('error', `Fehler beim Erstellen der MP3: ${error.message}`);
    } finally {
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }

  } else {
    // --- Bestehende Logik für MP4-Download ---
    const outputFilePath = path.join(downloadsPath, `${videoId}_${qualityLabel}.mp4`);
    const tempVideoPath = path.join(__dirname, `${videoId}_video.tmp`);
    const tempAudioPath = path.join(__dirname, `${videoId}_audio.tmp`);

    try {
      sendStatus('downloading_video', `Lade Video-Stream in ${qualityLabel}...`);
      const videoStream = ytdl(videoUrl, { 
          filter: format => format.qualityLabel === qualityLabel && format.hasVideo
      });
      await new Promise((resolve, reject) => {
          videoStream.pipe(fs.createWriteStream(tempVideoPath)).on('finish', resolve).on('error', reject);
      });

      sendStatus('downloading_audio', 'Lade Audio-Stream...');
      const audioStream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });
      await new Promise((resolve, reject) => {
          audioStream.pipe(fs.createWriteStream(tempAudioPath)).on('finish', resolve).on('error', reject);
      });

      sendStatus('merging', 'Füge Video und Audio zusammen...');
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -i "${tempAudioPath}" -c:v copy -c:a aac "${outputFilePath}"`;
      await new Promise((resolve, reject) => {
          exec(ffmpegCommand, (error) => (error ? reject(error) : resolve()));
      });
      
      const finalFileName = path.basename(outputFilePath);
      sendStatus('done', 'MP4-Download abgeschlossen!', { fileUrl: `/downloads/${finalFileName}` });

    } catch (error) {
      console.error(error);
      sendStatus('error', `Fehler beim Erstellen der MP4: ${error.message}`);
    } finally {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend-Server läuft auf http://localhost:${PORT} und ist im Netzwerk erreichbar.`);
});

// src/websocket.ts

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { WebSocketMessage } from './types';
import { getAvailableQualities, downloadFile } from './downloader';
import { Innertube } from 'youtubei.js'; // Importieren für die Validierung

export function initializeWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Frontend verbunden via WebSocket.');

    ws.on('message', async (message: string) => {
      try {
        const data: WebSocketMessage = JSON.parse(message);
        
        // KORREKTUR: Extrahiere nur die Video-ID
        const videoId = Innertube.extractId(data.url);
        if (!videoId) {
            ws.send(JSON.stringify({ status: 'error', message: 'Ungültige YouTube Video URL' }));
            return;
        }
        
        if (data.type === 'getFormats') {
          await getAvailableQualities(videoId, ws);
        } else if (data.type === 'download' && data.formatType && data.quality !== undefined) {
          await downloadFile(videoId, data.formatType, data.quality, ws);
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
}
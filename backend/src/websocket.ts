// src/websocket.ts

import { WebSocketServer, WebSocket } from 'ws';
import play from 'play-dl'; // GEÄNDERT
import http from 'http';
import { WebSocketMessage } from './types';
import { getAvailableQualities, downloadFile } from './downloader';

export function initializeWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Frontend verbunden via WebSocket.');

    ws.on('message', async (message: string) => {
      try {
        const data: WebSocketMessage = JSON.parse(message);

        // GEÄNDERT: Validierungs-Logik für play-dl
        const validation = await play.validate(data.url);
        if (!data.url || !validation || validation !== 'yt_video') {
          ws.send(JSON.stringify({ status: 'error', message: 'Ungültige YouTube Video URL' }));
          return;
        }
        
        if (data.type === 'getFormats') {
          await getAvailableQualities(data.url, ws);
        } else if (data.type === 'download' && data.formatType && data.quality !== undefined) {
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
}
// src/websocket.ts

import { WebSocketServer, WebSocket } from 'ws';
import ytdl from '@distube/ytdl-core';
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

        if (!data.url || !ytdl.validateURL(data.url)) {
          ws.send(JSON.stringify({ status: 'error', message: 'Ungültige YouTube URL' }));
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
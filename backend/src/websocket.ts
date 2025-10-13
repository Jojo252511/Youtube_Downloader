// src/websocket.ts

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { Innertube } from 'youtubei.js';
import { WebSocketMessage } from './types';
import { getAvailableQualities, downloadFile } from './downloader';

export function initializeWebSocketServer(server: http.Server, yt: Innertube) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Frontend verbunden via WebSocket.');

    ws.on('message', async (message: string) => {
      try {
        const data: WebSocketMessage = JSON.parse(message);
        
        if (!yt) {
          ws.send(JSON.stringify({ status: 'error', message: 'Server ist noch nicht bereit, bitte kurz warten.' }));
          return;
        }

        let info;
        try {
          // Wir verwenden den einfachen Aufruf, da die Instanz global konfiguriert ist.
          info = await yt.getInfo(data.url); 
        } catch (e: any) {
          console.error('Fehler beim Abrufen der Video-Infos:', e.message);
          ws.send(JSON.stringify({ status: 'error', message: `Video-Infos konnten nicht geladen werden: ${e.message}` }));
          return;
        }

        const videoId = info.basic_info.id;

        if (!videoId) {
            ws.send(JSON.stringify({ status: 'error', message: 'Konnte keine Video-ID aus der URL extrahieren.' }));
            return;
        }
        
        if (data.type === 'getFormats') {
          await getAvailableQualities(info, ws);
        } else if (data.type === 'download' && data.formatType && data.quality !== undefined) {
          await downloadFile(info, data.formatType, data.quality, ws, yt);
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
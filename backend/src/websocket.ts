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
        let videoId: string;
        
        try {
          // 1. Video-ID aus der URL extrahieren (robuste RegEx aus deinem Frontend)
          // eslint-disable-next-line no-useless-escape
          const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
          const match = data.url.match(regex);
          videoId = match ? match[1] : '';

          if (!videoId) {
            ws.send(JSON.stringify({ status: 'error', message: 'Konnte keine Video-ID aus der URL extrahieren.' }));
            return;
          }

          // *** HIER IST DIE FINALE KORREKTUR ***
          // Wir übergeben den Client als OBJEKT, nicht als String.
          // Dies behebt den TypeScript-Fehler UND den Laufzeitfehler 'No valid URL to decipher'.
          info = await yt.getInfo(videoId, { client: 'WEB' });

          console.log('Video-Infos erfolgreich abgerufen.');
          
        } catch (e: any) {
          console.error('Fehler beim Abrufen der Video-Infos:', e.message);
          ws.send(JSON.stringify({ status: 'error', message: `Video-Infos konnten nicht geladen werden: ${e.message}` }));
          return;
        }
        
        if (data.type === 'getFormats') {
          await getAvailableQualities(info, ws);
        } else if (data.type === 'download' && data.formatType && data.quality !== undefined) {
          await downloadFile(info, data.formatType, data.quality, ws, yt);
        }

      } catch (error) {
        console.error("Fehler in WebSocket 'message' Handler:", error);
        ws.send(JSON.stringify({ status: 'error', message: 'Ein Server-Fehler ist aufgetreten.' }));
      }
    });

    ws.on('close', () => {
      console.log('Frontend hat die Verbindung getrennt.');
    });
  });
}
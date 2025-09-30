// src/websocket.ts

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { Innertube, UniversalCache } from 'youtubei.js'; // UniversalCache importieren
import { WebSocketMessage } from './types';
import { getAvailableQualities, downloadFile } from './downloader';

export function initializeWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server });

  // Erstelle eine Instanz, um auf die Methoden zugreifen zu können
  let yt: Innertube;
  Innertube.create({ cache: new UniversalCache(false) }).then(innertube => {
    yt = innertube;
  });

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
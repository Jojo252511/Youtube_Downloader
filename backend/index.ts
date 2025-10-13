// src/index.ts

import { server } from './src/app';
import { initializeWebSocketServer } from './src/websocket';
import { cleanupDownloads } from './src/functions/cleanup';
import { Innertube, UniversalCache } from 'youtubei.js';

const PORT = 3000;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Jede Stunde

async function main() {
  // FINALE VERSION: Wir erstellen eine Standard-Instanz ohne spezielle Parameter.
  // Dies ist der robusteste Ansatz ohne Proxy oder Cookies.
  const yt = await Innertube.create({ 
    cache: new UniversalCache(false) 
  });
  console.log('youtubei.js-Instanz wurde mit Standard-Konfiguration initialisiert.');

  initializeWebSocketServer(server, yt);

  console.log('Automatischer Cleanup-Job für alte Dateien ist eingerichtet.');
  cleanupDownloads();
  setInterval(cleanupDownloads, CLEANUP_INTERVAL);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend-Server läuft auf http://localhost:${PORT} und ist im Netzwerk erreichbar.`);
  });
}

main().catch(err => {
  console.error('Fehler beim Initialisieren des Backends:', err);
  process.exit(1);
});
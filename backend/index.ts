// src/index.ts

import { server } from './src/app';
import { initializeWebSocketServer } from './src/websocket';
import { cleanupDownloads } from './src/functions/cleanup';

const PORT = 3000;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Jede Stunde

// 1. Initialisiere den WebSocket-Server und hänge ihn an den HTTP-Server
initializeWebSocketServer(server);

// 2. Starte den automatischen Aufräum-Job
console.log('Automatischer Cleanup-Job für alte Dateien ist eingerichtet.');
cleanupDownloads(); // Einmal beim Start ausführen
setInterval(cleanupDownloads, CLEANUP_INTERVAL); // Und dann jede Stunde

// 3. Starte den HTTP-Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend-Server läuft auf http://localhost:${PORT} und ist im Netzwerk erreichbar.`);
});
// index.ts

import { server } from './src/app';
import { initializeWebSocketServer } from './src/websocket';
import { cleanupDownloads } from './src/functions/cleanup';
import { Innertube, UniversalCache } from 'youtubei.js';

const PORT = 3000;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Jede Stunde

async function main() {
  try {
    // ANDROID Client ist am stabilsten für Downloads
    const yt = await Innertube.create({ 
      cache: new UniversalCache(false),
      // Wichtig: Verhindert Parser-Fehler
      generate_session_locally: true,
    });
    
    console.log('youtubei.js-Instanz wurde erfolgreich initialisiert.');

    initializeWebSocketServer(server, yt);

    console.log('Automatischer Cleanup-Job für alte Dateien ist eingerichtet.');
    cleanupDownloads();
    setInterval(cleanupDownloads, CLEANUP_INTERVAL);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Backend-Server läuft auf http://localhost:${PORT} und ist im Netzwerk erreichbar.`);
    });
  } catch (initError) {
    console.error('Kritischer Fehler bei der Initialisierung:', initError);
    console.log('Versuche alternative Konfiguration...');
    
    // Fallback-Konfiguration
    try {
      const yt = await Innertube.create({ 
        cache: new UniversalCache(false),
        retrieve_player: false, // Deaktiviert Player-Parsing
      });
      
      console.log('YouTubei.js mit Fallback-Konfiguration gestartet.');
      initializeWebSocketServer(server, yt);
      cleanupDownloads();
      setInterval(cleanupDownloads, CLEANUP_INTERVAL);

      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend-Server läuft auf http://localhost:${PORT} (Fallback-Modus)`);
      });
    } catch (fallbackError) {
      console.error('Auch Fallback-Initialisierung fehlgeschlagen:', fallbackError);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Unerwarteter Fehler beim Starten des Backends:', err);
  process.exit(1);
});
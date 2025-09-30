// cleanup.ts

import { promises as fs } from 'fs';
import path from 'path';

// Definieren, wie ein einzelner Eintrag in unserer DB aussieht
interface DBEntry {
  filename: string;
  createdAt: number;
}

// Definieren, wie die gesamte Datenbank-Struktur aussieht
interface Database {
  [id: string]: DBEntry;
}

const DB_PATH = path.join(__dirname, 'db.json');
const DOWNLOADS_PATH = path.join(__dirname, '..', '..', 'downloads');
const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 Stunden in Millisekunden

export async function cleanupDownloads(): Promise<void> {
  console.log('Starte Aufräum-Job für alte Downloads...');
  try {
    let dbData: string;
    try {
      dbData = await fs.readFile(DB_PATH, 'utf-8');
    } catch (readError: any) {
      if (readError.code === 'ENOENT') {
        console.log('db.json nicht gefunden, erstelle eine neue.');
        await fs.writeFile(DB_PATH, JSON.stringify({}));
        return; // Job für dieses Mal beenden, da die DB leer war
      }
      throw readError; // Andere Lesefehler weiterwerfen
    }

    const db: Database = JSON.parse(dbData || '{}');
    
    const now = Date.now();
    let changesMade = false;

    for (const id in db) {
      const entry = db[id];
      
      if (now - entry.createdAt > EXPIRATION_TIME) {
        console.log(`Eintrag ${id} (${entry.filename}) ist abgelaufen. Lösche...`);
        
        const filePath = path.join(DOWNLOADS_PATH, entry.filename);
        
        try {
          await fs.unlink(filePath);
          console.log(`Datei ${entry.filename} erfolgreich gelöscht.`);
        } catch (fileError: any) {
          if (fileError.code !== 'ENOENT') {
            console.error(`Konnte Datei ${entry.filename} nicht löschen:`, fileError);
          }
        }
        
        delete db[id];
        changesMade = true;
      }
    }

    if (changesMade) {
      await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
      console.log('Datenbank wurde aktualisiert.');
    } else {
      console.log('Keine abgelaufenen Dateien gefunden.');
    }

  } catch (error: any) {
    console.error('Fehler während des Aufräum-Jobs:', error);
  }
}
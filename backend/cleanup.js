// cleanup.js

const fs = require('fs').promises; // Wir benutzen die Promise-Version von fs
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
const DOWNLOADS_PATH = path.join(__dirname, 'downloads');
const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 Stunden in Millisekunden

async function cleanupDownloads() {
  console.log('Starte Aufräum-Job für alte Downloads...');
  try {
    // Lese die Datenbank
    let dbData = await fs.readFile(DB_PATH, 'utf-8');
    const db = JSON.parse(dbData || '{}');
    
    const now = Date.now();
    let changesMade = false;

    // Gehe durch alle Einträge in der DB
    for (const id in db) {
      const entry = db[id];
      
      // Prüfe, ob der Eintrag älter als 24 Stunden ist
      if (now - entry.createdAt > EXPIRATION_TIME) {
        console.log(`Eintrag ${id} (${entry.filename}) ist abgelaufen. Lösche...`);
        
        const filePath = path.join(DOWNLOADS_PATH, entry.filename);
        
        try {
          // Lösche die eigentliche Datei
          await fs.unlink(filePath);
          console.log(`Datei ${entry.filename} erfolgreich gelöscht.`);
        } catch (fileError) {
          // Fehler, falls die Datei schon weg ist, ist okay.
          if (fileError.code !== 'ENOENT') {
            console.error(`Konnte Datei ${entry.filename} nicht löschen:`, fileError);
          }
        }
        
        // Lösche den Eintrag aus der DB
        delete db[id];
        changesMade = true;
      }
    }

    // Wenn Änderungen vorgenommen wurden, speichere die DB neu
    if (changesMade) {
      await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
      console.log('Datenbank wurde aktualisiert.');
    } else {
      console.log('Keine abgelaufenen Dateien gefunden.');
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      // Wenn die db.json nicht existiert, ist das okay.
      await fs.writeFile(DB_PATH, JSON.stringify({}));
    } else {
      console.error('Fehler während des Aufräum-Jobs:', error);
    }
  }
}

module.exports = { cleanupDownloads };
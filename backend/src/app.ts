// src/app.ts

import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

// --- Express App und HTTP Server Setup ---
export const app = express();
app.use(cors());
export const server = http.createServer(app);

const downloadsPath = path.join(__dirname, '..', 'downloads');

// Sicherstellen, dass der Ordner existiert
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath);
}

// --- Routen ---

// Route für den Download-Link
app.get('/downloads/:id', async (req: Request, res: Response) => {
    try {
        const dbPath = path.join(__dirname, '..', 'db.json');
        const dbData = await fs.promises.readFile(dbPath, 'utf-8');
        const db = JSON.parse(dbData);
        
        const entry = db[req.params.id];
        if (entry) {
            const filePath = path.join(downloadsPath, entry.filename);
            res.download(filePath, entry.filename, (err) => {
              if (err && !res.headersSent) {
                 res.status(404).send('Datei nicht gefunden. Möglicherweise wurde sie bereits gelöscht.');
              }
            });
        } else {
            res.status(404).send('Download nicht gefunden oder abgelaufen.');
        }
    } catch (error) {
        console.error("Download-Routen-Fehler:", error);
        res.status(500).send('Serverfehler.');
    }
});
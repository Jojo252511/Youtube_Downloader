// src/types/index.ts

export interface CompletedDownload {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  artist: string;
}

// Typ für die Daten, die vom WebSocket-Server kommen
export interface WebSocketData {
  status: string;
  message: string;
  qualities?: string[];
  thumbnailUrl?: string;
  title?: string;
  artist?: string;
  fileUrl?: string;
  uniqueId?: string;
}
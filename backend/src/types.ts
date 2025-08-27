// src/types.ts

export interface WebSocketMessage {
  type: 'getFormats' | 'download';
  url: string;
  formatType?: 'mp3' | 'mp4';
  quality?: string;
}

export interface StatusMessage {
  status: string;
  message: string;
  qualities?: string[];
  thumbnailUrl?: string;
  title?: string;
  artist?: string;
  fileUrl?: string;
  uniqueId?: string;
}

export interface DBEntry {
  filename: string;
  createdAt: number;
}

export interface Database {
  [id: string]: DBEntry;
}
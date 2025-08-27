// src/composables/useWebSocket.ts

import { ref } from 'vue';
import type { Ref } from 'vue';
import type { WebSocketData, CompletedDownload } from '@/types';

// Diese Funktion ist der "Composable". Sie gibt reaktive Variablen und Funktionen zurück.
export function useWebSocket(
  youtubeUrl: Ref<string>,
  currentThumbnailUrl: Ref<string>,
  currentVideoTitle: Ref<string>,
  currentVideoArtist: Ref<string>
) {
  // Reaktive Variablen, die vom Composable verwaltet werden
  const isLoading = ref<boolean>(false);
  const formatsLoading = ref<boolean>(false);
  const statusMessage = ref<string>('');
  const availableQualities = ref<string[]>([]);
  const downloadProgress = ref<number>(0);
  const completedDownloads = ref<CompletedDownload[]>([]);

  let ws: WebSocket | null = null;
  const backendHost: string = window.location.hostname;
  const backendUrl = `ws://${backendHost}:3000`;

    const resetInputState = () => {
        youtubeUrl.value = '';
        currentThumbnailUrl.value = '';
        currentVideoTitle.value = '';
        currentVideoArtist.value = '';
        availableQualities.value = [];
        statusMessage.value = '';
    };

  const connectWebSocket = () => {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    ws = new WebSocket(backendUrl);
    ws.onopen = () => console.log('Verbunden mit Backend!');
    ws.onmessage = handleWebSocketMessage;
    ws.onerror = () => {
      statusMessage.value = 'Verbindungsfehler. Läuft das Backend?';
      isLoading.value = false;
      formatsLoading.value = false;
      downloadProgress.value = 0;
    };
  };

  const handleWebSocketMessage = (event: MessageEvent) => {
    const data: WebSocketData = JSON.parse(event.data);

    if (data.status !== 'done') {
        statusMessage.value = data.message;
    }
  
    switch (data.status) {
      case 'error':
        isLoading.value = false;
        formatsLoading.value = false;
        downloadProgress.value = 0;
        break;
      case 'formats_loaded':
        availableQualities.value = data.qualities || [];
        currentThumbnailUrl.value = data.thumbnailUrl || '';
        currentVideoTitle.value = data.title || '';
        currentVideoArtist.value = data.artist || '';
        formatsLoading.value = false;
        statusMessage.value = 'Bitte wähle eine Qualität aus.';
        break;
      case 'info':
        downloadProgress.value = 5;
        break;
      case 'downloading_thumb':
        downloadProgress.value = 15;
        break;
      case 'downloading_video':
      case 'downloading_audio':
        downloadProgress.value = 50;
        break;
      case 'merging':
        downloadProgress.value = 90;
        break;
      case 'done': {
        const newDownload: CompletedDownload = {
          url: `http://${backendHost}:3000${data.fileUrl}`,
          thumbnailUrl: currentThumbnailUrl.value,
          title: currentVideoTitle.value,
          artist: currentVideoArtist.value,
          id: data.uniqueId as string
        };
        completedDownloads.value.unshift(newDownload);
        downloadProgress.value = 100;
        statusMessage.value = "Fertig!";
        setTimeout(() => {
          isLoading.value = false;
          resetInputState();
        }, 1500);
        break;
      }
    }
  };

  const sendMessage = (payload: object) => {
    connectWebSocket(); // Stellt sicher, dass eine Verbindung besteht
    const checkConnection = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      } else {
        setTimeout(checkConnection, 100);
      }
    };
    checkConnection();
  };
  
  // Wir geben alle Variablen und Funktionen zurück, die die App.vue benötigt
  return {
    isLoading,
    formatsLoading,
    statusMessage,
    availableQualities,
    downloadProgress,
    completedDownloads,
    sendMessage,
    resetInputState
  };
}
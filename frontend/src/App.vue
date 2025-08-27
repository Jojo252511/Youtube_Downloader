<template>
  <div id="app">
    <div class="container">
      <header>
        <svg xmlns="http://www.w3.org/2000/svg" width="78" height="48" viewBox="0 0 24 24" class="logo">
          <rect x="-2" y="3" width="28" height="18" rx="4" ry="4" fill="#3d52d5"></rect>
          <path d="M10 8 L16 12 L10 16 Z" fill="white"></path>
        </svg>
        <h1>YouTube Downloader</h1>
        <p class="subtitle">Dein privates Tool für YouTube-Videos in höchster Qualität.</p>
      </header>
      <main>
        <div class="input-container">
          <input v-model="youtubeUrl" type="text" placeholder="YouTube Video URL hier einfügen"
            :disabled="isLoading || formatsLoading" @focus="clearOnFocus"/>
        </div>

        <div class="preview-container" v-if="currentThumbnailUrl || embedUrl">
          <Transition name="fade" mode="out-in">
            <img v-if="currentThumbnailUrl && (selectedFormat === 'mp3' || !embedUrl)" :src="currentThumbnailUrl" class="preview-video" alt="Video Thumbnail"/>
            <iframe v-else-if="embedUrl && selectedFormat === 'mp4'" width="100%" height="350" class="preview-video" :src="embedUrl"
              title="YouTube Video Vorschau" frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>
            </iframe>
          </Transition>
        </div>

        <div class="format-selector">
          <label :class="{ active: selectedFormat === 'mp4' }">
            <input type="radio" v-model="selectedFormat" value="mp4" name="format"> MP4 (Video)
          </label>
          <label :class="{ active: selectedFormat === 'mp3' }">
            <input type="radio" v-model="selectedFormat" value="mp3" name="format"> MP3 (Audio)
          </label>
        </div>

        <Transition name="fade">
          <div v-if="selectedFormat === 'mp4' && (formatsLoading || availableQualities.length > 0)"
            class="quality-container">
            <div v-if="formatsLoading" class="loader-small"></div>
            <select v-else v-model="selectedQuality" :disabled="isLoading">
              <option disabled value="">Qualität wählen...</option>
              <option v-for="quality in availableQualities" :key="quality" :value="quality">
                {{ quality }}
              </option>
            </select>
          </div>
        </Transition>

        <button @click="startDownload" :disabled="downloadIsDisabled" class="download-button">
          <div v-if="!isLoading" class="button-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download starten</span>
          </div>

          <div v-else class="progress-container">
            <div class="progress-bar" :style="{ width: downloadProgress + '%' }"></div>
            <span class="progress-text">{{ statusMessage }}</span>
          </div>
        </button>

        <TransitionGroup name="list" tag="div" class="download-list">
          <div v-for="download in completedDownloads" :key="download.id" class="download-card">
            <img :src="download.thumbnailUrl" alt="Video Thumbnail" class="download-card-thumb">
            <div class="download-card-info">
              <h3 class="download-card-title">{{ download.title }}</h3>
              <p class="download-card-artist">{{ download.artist }}</p>
            </div>
            <a :href="download.url" target="_blank" class="download-card-button" title="Datei herunterladen">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </div>
        </TransitionGroup>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const youtubeUrl = ref('');
const isLoading = ref(false);
const formatsLoading = ref(false);
const statusMessage = ref('');
const availableQualities = ref([]);
const selectedQuality = ref('');
const selectedFormat = ref('mp4');
const downloadProgress = ref(0);

// Variablen für den *aktuellen* Download-Vorgang
const currentThumbnailUrl = ref('');
const currentVideoTitle = ref('');
const currentVideoArtist = ref('');

// Array für alle *fertigen* Downloads
const completedDownloads = ref([]);

const backendHost = window.location.hostname;
const backendUrl = `ws://${backendHost}:3000`;
let ws = null;
let debounceTimer = null;

watch(youtubeUrl, (newUrl) => {
  if (!newUrl) {
    clearOnFocus();
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (isValidYoutubeUrl(newUrl)) {
      fetchFormats();
    }
  }, 500);
});

const isValidYoutubeUrl = (url) => {
  // eslint-disable-next-line no-useless-escape
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return regex.test(url);
};

const embedUrl = computed(() => {
  if (!youtubeUrl.value || !isValidYoutubeUrl(youtubeUrl.value)) {
    return '';
  }
  // eslint-disable-next-line no-useless-escape
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = youtubeUrl.value.match(regex);
  return match ? `https://www.youtube.com/embed/${match[1]}` : '';
});

const downloadIsDisabled = computed(() => {
  if (isLoading.value || formatsLoading.value || !youtubeUrl.value) return true;
  if (selectedFormat.value === 'mp4' && !selectedQuality.value) return true;
  return false;
});

function clearOnFocus() {
  availableQualities.value = [];
  selectedQuality.value = '';
  statusMessage.value = '';
  // Wichtig: Die Liste der fertigen Downloads wird NICHT geleert
}

function clearInput() {
  youtubeUrl.value = '';
  clearOnFocus();
  currentThumbnailUrl.value = '';
  currentVideoTitle.value = '';
  currentVideoArtist.value = '';
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(backendUrl);
  ws.onopen = () => console.log('Verbunden mit Backend!');
  ws.onmessage = handleWebSocketMessage;
  ws.onerror = (error) => {
    console.error('WebSocket Fehler:', error);
    statusMessage.value = 'Verbindungsfehler. Läuft das Backend?';
    isLoading.value = false;
    formatsLoading.value = false;
    downloadProgress.value = 0;
  };
}

function handleWebSocketMessage(event) {
  const data = JSON.parse(event.data);
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
      availableQualities.value = data.qualities;
      currentThumbnailUrl.value = data.thumbnailUrl;
      currentVideoTitle.value = data.title;
      currentVideoArtist.value = data.artist;
      formatsLoading.value = false;
      statusMessage.value = 'Bitte wähle eine Qualität aus.';
      if (data.qualities.length > 0) {
        selectedQuality.value = data.qualities[0];
      }
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
      const newDownload = {
        url: `http://${backendHost}:3000${data.fileUrl}`,
        thumbnailUrl: currentThumbnailUrl.value,
        title: currentVideoTitle.value,
        artist: currentVideoArtist.value,
        id: crypto.randomUUID()
      };
      completedDownloads.value.unshift(newDownload);
      downloadProgress.value = 100;
      statusMessage.value = "Fertig!";
      setTimeout(() => {
        isLoading.value = false;
        clearInput(); // Leert das Input-Feld für den nächsten Download
      }, 1500);
      break;
      }
  }
}

function fetchFormats() {
  if (!youtubeUrl.value) return;
  clearOnFocus();
  currentThumbnailUrl.value = '';
  currentVideoTitle.value = '';
  currentVideoArtist.value = '';
  formatsLoading.value = true;
  statusMessage.value = 'Fordere Video-Informationen an...';
  connectWebSocket();

  const checkConnection = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'getFormats', url: youtubeUrl.value }));
    } else {
      setTimeout(checkConnection, 100);
    }
  };
  checkConnection();
}

function startDownload() {
  if (downloadIsDisabled.value) return;
  isLoading.value = true;
  downloadProgress.value = 0;
  statusMessage.value = 'Download wird gestartet...';
  connectWebSocket();
  ws.send(JSON.stringify({
    type: 'download',
    url: youtubeUrl.value,
    formatType: selectedFormat.value,
    quality: selectedQuality.value
  }));
}
</script>

<style>
/* ... (dein bestehendes CSS bis auf die entfernten Klassen) ... */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;700&display=swap');

:root {
  --primary-color: #3d52d5;
  --primary-hover: #3141a5;
  --success-color: #28a745;
  --error-color: #dc3545;
  --info-color: #007bff;
  --light-color: #f8f9fa;
  --dark-color: #343a40;
  --text-color: #212529;
  --bg-gradient: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-image: var(--bg-gradient);
  color: var(--text-color);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradientAnimation 15s ease infinite;
}
  
@keyframes gradientAnimation {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

#app {
  width: 100%;
  display: flex;
  justify-content: center;
}

.container {
  width: 100%;
  max-width: 650px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: var(--shadow);
  padding: 2rem;
  transition: all 0.3s ease;
  transition: 0.5s;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  color: var(--primary-color);
  margin-bottom: 0.5rem;
  animation: float 3s ease-in-out infinite;
}

h1 {
  font-weight: 700;
  font-size: 2rem;
}

.subtitle {
  font-weight: 300;
  color: #6c757d;
  font-size: 1rem;
}

.input-container {
  margin-bottom: 1.5rem;
}

.preview-container {
  width: 100%;
  height: 350px;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
}

.preview-video {
  width: 100%;
  height: 100%;
  border: none;
  object-fit: cover;
}

.quality-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.download-button {
  width: 100%;
  margin-top: 1.5rem;
  height: 50px; /* Etwas mehr Höhe für den Text */
  position: relative;
  overflow: hidden;
}

input[type="text"],
select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  font-family: 'Poppins', sans-serif;
  transition: all 0.3s ease;
  background-color: white;
}

input[type="text"]:focus,
select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(61, 82, 213, 0.2);
}

.format-selector {
  display: flex;
  justify-content: center;
  background-color: #e9ecef;
  border-radius: 8px;
  padding: 0.25rem;
  margin-bottom: 1.5rem;
}

.format-selector label {
  flex: 1;
  text-align: center;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.format-selector label.active {
  background-color: var(--primary-color);
  color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.format-selector input[type="radio"] {
  display: none;
}

button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  background-color: var(--primary-color);
  color: white;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

button:hover:not(:disabled) {
  background-color: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(61, 82, 213, 0.3);
}

button:disabled {
  background-color: #a5b0e5;
  cursor: not-allowed;
}

.button-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.loader-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary-color);
  animation: spin 1s ease-in-out infinite;
}

.progress-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: var(--primary-hover);
  transition: width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.progress-text {
  position: relative;
  z-index: 1;
  color: white;
  font-weight: 500;
}

/* --- NEUE STILE --- */
.download-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem; /* Abstand zwischen den Karten */
  margin-top: 1.5rem;
}

.download-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background-color: var(--light-color);
  padding: 0.75rem;
  border-radius: 8px;
  border-left: 5px solid var(--success-color);
}

.download-card-thumb {
  width: 80px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.download-card-info {
  flex-grow: 1;
  overflow: hidden;
  text-align: left;
}

.download-card-title {
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.download-card-artist {
  font-size: 0.8rem;
  color: #6c757d;
  margin: 0;
}

.download-card-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  text-decoration: none;
  flex-shrink: 0;
  transition: background-color 0.3s ease;
}

.download-card-button:hover {
  background-color: var(--primary-hover);
}

/* Animationen */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@media (max-width: 600px) {
  .container { padding: 1.5rem; }
  h1 { font-size: 1.75rem; }
}
</style>
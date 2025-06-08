<template>
  <div id="app">
    <div class="container">
      <header>
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="logo">
          <path
            d="M2.5 17a2.4 2.4 0 0 1 3 0A2.4 2.4 0 0 1 8.5 17a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0" />
          <path d="M8.5 17a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0" />
          <path
            d="M2.5 12a2.4 2.4 0 0 1 3 0A2.4 2.4 0 0 1 8.5 12a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0" />
          <path d="M8.5 12a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0" />
          <path
            d="M2.5 7a2.4 2.4 0 0 1 3 0A2.4 2.4 0 0 1 8.5 7a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0a2.4 2.4 0 0 1 3 0" />
          <path d="M8.5 7a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0a2.4 2.4 0 0 0 3 0" />
        </svg>
        <h1>Video Downloader</h1>
        <p class="subtitle">Dein privates Tool für YouTube-Videos in höchster Qualität.</p>
      </header>
      <main>
        <div class="input-container">
          <input v-model="youtubeUrl" type="text" placeholder="YouTube Video URL hier einfügen"
            :disabled="isLoading || formatsLoading" @change="fetchFormats" @focus="clearInput" />
        </div>

        <!-- Formatauswahl MP4 / MP3 -->
        <div class="format-selector">
          <label :class="{ active: selectedFormat === 'mp4' }">
            <input type="radio" v-model="selectedFormat" value="mp4" name="format"> MP4 (Video)
          </label>
          <label :class="{ active: selectedFormat === 'mp3' }">
            <input type="radio" v-model="selectedFormat" value="mp3" name="format"> MP3 (Audio)
          </label>
        </div>

        <!-- Dropdown für die Qualitätsauswahl (nur bei MP4 sichtbar) -->
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

        <!-- Angepasster Download-Button -->
        <button @click="startDownload" :disabled="downloadIsDisabled" class="download-button">
          <span v-if="!isLoading">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download starten</span>
          </span>
          <span v-else class="loader"></span>
        </button>

        <Transition name="fade">
          <div v-if="statusMessage" class="status-container" :class="statusType">
            <p class="status-message">{{ statusMessage }}</p>
            <a v-if="downloadUrl" :href="downloadUrl" target="_blank" class="download-link">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <span>Fertige Datei herunterladen</span>
            </a>
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const youtubeUrl = ref('');
const isLoading = ref(false);
const formatsLoading = ref(false);
const statusMessage = ref('');
const statusType = ref('');
const downloadUrl = ref('');
const availableQualities = ref([]);
const selectedQuality = ref('');
const selectedFormat = ref('mp4');

const backendHost = window.location.hostname;
const backendUrl = `ws://${backendHost}:3000`;
let ws = null;

const downloadIsDisabled = computed(() => {
  if (isLoading.value || formatsLoading.value || !youtubeUrl.value) return true;
  if (selectedFormat.value === 'mp4' && !selectedQuality.value) return true;
  return false;
});

function clearInput() {
  youtubeUrl.value = '';
  availableQualities.value = [];
  selectedQuality.value = '';
  statusMessage.value = '';
  selectedFormat.value = 'mp4';
}

function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(backendUrl);
  ws.onopen = () => console.log('Verbunden mit Backend!');
  ws.onmessage = handleWebSocketMessage;
  ws.onerror = (error) => {
    console.error('WebSocket Fehler:', error);
    statusMessage.value = 'Verbindungsfehler. Läuft das Backend?';
    statusType.value = 'error';
    isLoading.value = false;
    formatsLoading.value = false;
  };
}

function handleWebSocketMessage(event) {
  const data = JSON.parse(event.data);
  statusMessage.value = data.message;
  switch (data.status) {
    case 'error':
      statusType.value = 'error';
      isLoading.value = false;
      formatsLoading.value = false;
      break;
    case 'formats_loaded':
      availableQualities.value = data.qualities;
      formatsLoading.value = false;
      statusMessage.value = 'Bitte wähle eine Qualität aus.';
      statusType.value = 'info';
      if (data.qualities.length > 0) {
        selectedQuality.value = data.qualities[0];
      }
      break;
    case 'done':
      statusType.value = 'done';
      downloadUrl.value = `http://${backendHost}:3000${data.fileUrl}`;
      isLoading.value = false;
      break;
    default:
      statusType.value = 'info';
  }
}

function fetchFormats() {
  if (!youtubeUrl.value || !youtubeUrl.value.includes('http')) return;
  availableQualities.value = [];
  selectedQuality.value = '';
  formatsLoading.value = true;
  statusMessage.value = 'Fordere Video-Informationen an...';
  connectWebSocket();
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'getFormats', url: youtubeUrl.value }));
      clearInterval(interval);
    }
  }, 100);
}

function startDownload() {
  if (downloadIsDisabled.value) return;
  isLoading.value = true;
  statusMessage.value = 'Download-Anfrage wird gesendet...';
  statusType.value = 'info';
  downloadUrl.value = '';
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

.quality-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.download-button {
  width: 100%;
  margin-top: 1.5rem;
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
  position: relative;
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

button span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-container {
  margin-top: 10px;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  border-left: 5px solid;
  background-color: var(--light-color);
}

.status-container.info {
  border-color: var(--info-color);
}

.status-container.error {
  border-color: var(--error-color);
  color: var(--error-color);
}

.status-container.done {
  border-color: var(--success-color);
}

.download-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  font-weight: 500;
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.3s ease;
}

.download-link:hover {
  color: var(--primary-hover);
  text-decoration: underline;
}

.loader,
.loader-small {
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s ease-in-out infinite;
}

.loader {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
}

.loader-small {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(0, 0, 0, 0.1);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes float {
  0% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-8px);
  }

  100% {
    transform: translateY(0px);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 600px) {
  .container {
    padding: 1.5rem;
  }

  h1 {
    font-size: 1.75rem;
  }
}
</style>

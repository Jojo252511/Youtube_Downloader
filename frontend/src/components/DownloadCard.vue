<template>
  <div class="download-card">
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
</template>

<script setup lang="ts">
import type { CompletedDownload } from '@/types';
import type { PropType } from 'vue';

// Diese Komponente empfängt ein "download"-Objekt von der App.vue
defineProps({
  download: {
    type: Object as PropType<CompletedDownload>,
    required: true
  }
});
</script>

<style scoped>
/* Das CSS für die Karte. 'scoped' sorgt dafür, dass die Stile nur hier gelten. */
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
</style>
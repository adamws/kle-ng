<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { preloadMakerJsModule } from '@/utils/makerjs-loader'
import { preloadThreeModule } from '@/utils/three-loader'
import PlateGeneratorSettings from './PlateGeneratorSettings.vue'
import PlateOutlineSettings from './PlateOutlineSettings.vue'
import PlateHolesSettings from './PlateHolesSettings.vue'
import PlateGeneratorControls from './PlateGeneratorControls.vue'
import PlateGeneratorResults from './PlateGeneratorResults.vue'
import PlateDownloadButtons from './PlateDownloadButtons.vue'
import PlateJsonView from './PlateJsonView.vue'
import Plate3DSettings from './Plate3DSettings.vue'
import ScrollableTabs from './ScrollableTabs.vue'

const tabs = [
  { id: 'cutouts', label: 'Switch Cutouts' },
  { id: 'holes', label: 'Holes' },
  { id: 'outline', label: 'Outline' },
  { id: '3d', label: '3D' },
  { id: 'json', label: 'JSON' },
] as const

const activeTab = ref<(typeof tabs)[number]['id']>('cutouts')

// Preload maker.js and Three.js when component mounts
onMounted(() => {
  preloadMakerJsModule()
  preloadThreeModule()
})
</script>

<template>
  <div class="plate-generator-panel">
    <!-- Two Column Layout: Controls | Output -->
    <div class="row g-3">
      <!-- Left Column: Tabbed Controls -->
      <div class="col-lg-4 settings-column">
        <!-- Settings Card -->
        <div class="settings-card">
          <ScrollableTabs v-model="activeTab" :tabs="tabs" testid-prefix="plate-tab">
            <!-- Cutouts Tab -->
            <template #cutouts>
              <PlateGeneratorSettings />
            </template>

            <!-- Holes Tab -->
            <template #holes>
              <PlateHolesSettings />
            </template>

            <!-- Outline Tab -->
            <template #outline>
              <PlateOutlineSettings />
            </template>

            <!-- 3D Tab -->
            <template #3d>
              <Plate3DSettings />
            </template>

            <!-- JSON Tab -->
            <template #json>
              <PlateJsonView />
            </template>
          </ScrollableTabs>
        </div>

        <!-- Controls Card (always visible below settings) -->
        <div class="controls-card">
          <PlateGeneratorControls />
          <PlateDownloadButtons />
        </div>
      </div>

      <!-- Right Column: All Output -->
      <div class="col-lg-8 results-column">
        <div class="results-card">
          <PlateGeneratorResults />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plate-generator-panel {
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.settings-column {
  max-width: 500px;
}

/* Card styling matching Key Properties panel */
.settings-card,
.controls-card,
.results-card {
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 12px;
}

.settings-card {
  margin-bottom: 12px;
}

.controls-card {
  padding: 10px 12px;
}

.results-column {
  position: relative;
}

.results-card {
  position: absolute;
  top: 0;
  left: calc(var(--bs-gutter-x) * 0.5);
  right: calc(var(--bs-gutter-x) * 0.5);
  bottom: 0;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

@media (max-width: 991.98px) {
  .settings-column {
    max-width: none;
  }

  .results-card {
    position: static;
    min-height: 300px;
  }
}
</style>

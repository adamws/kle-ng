<template>
  <BaseHelpModal :is-visible="isVisible" title="PCB Generator - Help" @close="close">
    <template #icon>
      <i class="bi bi-cpu"></i>
    </template>

    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-info-circle"></i>
        What is PCB Generator?
      </h6>
      <div class="help-content">
        <p>
          The PCB Generator creates a <a href="https://kicad.org">KiCad</a> project files based on
          your keyboard layout. It creates key matrix schematic and places switch and diode
          footprints according to your layout's key positions and can optionally route the
          connections between components.
        </p>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-exclamation-triangle"></i>
        Prerequisites
      </h6>
      <div class="help-content">
        <img
          align="right"
          src="/via-layout-example.png"
          alt="Example of VIA layout format showing matrix coordinates on keycaps"
          class="help-image"
        />
        <p>Before generating a PCB, your layout must have:</p>
        <ul class="tips-list">
          <li>
            <strong>Matrix coordinates</strong> - Each key must have row/column assignments in the
            VIA label format (e.g., <code>0,0</code> for row 0, column 0). Use
            <strong>Extra Tools &rarr; Add Switch Matrix Coordinates</strong> if needed.
          </li>
          <li>
            <strong>Maximum 150 keys</strong> - Layouts with more than 150 keys are not supported
          </li>
        </ul>
        <div class="info-box">
          <div class="d-flex align-items-start gap-2">
            <i class="bi bi-lightbulb-fill text-info flex-shrink-0"></i>
            <div>
              <small>
                Matrix coordinates determine how switches are wired in the keyboard matrix.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-gear"></i>
        Generating a PCB
      </h6>
      <div class="help-content">
        <img
          align="right"
          src="/pcb-generator-footprints-preview.png"
          alt="Example of footprint preview in PCB Generator"
          class="help-image"
        />
        <ol>
          <li>
            Configure switch, diode, and routing options as needed, use preview window to check
            key-diode placement
          </li>
          <li>Click the <strong>Generate PCB</strong> button</li>
          <li>Wait for the server to process your layout</li>
          <li>Once complete, preview renders will be displayed</li>
          <li>
            Click <strong>Download</strong> to save the <code>.kicad_pcb</code> file, click
            <strong>New Task</strong> to start over
          </li>
        </ol>
        <div class="warning-box">
          <div class="d-flex align-items-start gap-2">
            <i class="bi bi-exclamation-triangle-fill text-warning flex-shrink-0"></i>
            <div>
              <small> Preview does not support displaying traces. </small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-lightbulb"></i>
        Tips
      </h6>
      <div class="help-content">
        <ul class="tips-list">
          <li><strong>Download expiration</strong> - Generated PCB files expire after 1 hour.</li>
          <li>
            <strong>Rate limiting</strong> - There is a 5-second cooldown between generation
            requests to prevent server overload.
          </li>
          <li>
            <strong>Worker status</strong> - The PCB generator runs on a remote worker. If the
            service is temporarily unavailable, try again later.
          </li>
          <li>
            <strong>KiCad compatibility</strong> - Generated files are compatible with KiCad 9+.
            Open the file to add mounting holes, USB connector, microcontroller, and other
            components to finish your keyboard.
          </li>
        </ul>
      </div>
    </div>
  </BaseHelpModal>
</template>

<script setup lang="ts">
import BaseHelpModal from './BaseHelpModal.vue'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const close = () => {
  emit('close')
}
</script>

<style scoped>
.info-box {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-info);
  margin-top: 0.75rem;
  overflow: hidden; /* Prevents overlap with floated images */
}

.warning-box {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-warning);
  margin-top: 0.75rem;
  overflow: hidden; /* Prevents overlap with floated images */
}

.help-image {
  max-width: 200px;
  margin-left: 1rem;
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .help-image {
    float: none;
    display: block;
    margin: 0 auto 1rem;
    max-width: 100%;
  }
}
</style>

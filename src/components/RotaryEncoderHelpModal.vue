<template>
  <BaseHelpModal :is-visible="isVisible" title="Rotary Encoder Mount - Help" @close="close">
    <div class="help-section">
      <h6 class="help-section-title">What does this affect?</h6>
      <div class="help-content">
        <p>
          This option only affects keys marked as <strong>rotary encoders</strong> (EC11), set via
          the <em>Rotary Encoder</em> checkbox in the <b>Key Properties</b> panel. Regular switch
          keys are not affected.
        </p>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">PCB build (default — checkbox off)</h6>
      <div class="help-content">
        <p>
          The encoder is soldered to the PCB and sits in a normal switch position, so the plate gets
          a standard <strong>14×14&nbsp;mm</strong> rectangular cutout through the full plate
          thickness. The encoder body lives in the gap between the plate and the PCB.
        </p>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">Handwired build (checkbox on)</h6>
      <div class="help-content">
        <p>
          For handwired keyboards with <strong>no PCB</strong>, the plate gets a
          <strong>circular screw-in cutout</strong> so the EC11 can be fixed by its threaded bushing
          and nut, plus a square backside clearance pocket (in 3D/STL output) to clear the encoder
          body.
        </p>
        <div class="warning-box">
          <div class="d-flex align-items-center gap-2">
            <BiExclamationTriangle class="text-warning" />
            <div class="small">
              A screw-mounted encoder body will <strong>not</strong> fit between a plate and a PCB.
              Only enable this for handwired builds.
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseHelpModal>
</template>

<script setup lang="ts">
import BaseHelpModal from './BaseHelpModal.vue'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'

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
.warning-box {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-warning);
  margin-top: 0.75rem;
  overflow: hidden;
}
</style>

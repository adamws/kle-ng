<template>
  <BaseHelpModal :is-visible="isVisible" title="VIA Metadata - Help" @close="close">
    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-info-circle"></i>
        What is VIA Metadata?
      </h6>
      <div class="help-content">
        <img
          align="right"
          src="/via-layout-example.png"
          alt="Example of VIA layout format showing matrix coordinates on keycaps"
          class="via-example-image"
        />
        <p>
          <a href="https://www.caniusevia.com/" target="_blank">VIA</a> and
          <a href="https://get.vial.today/" target="_blank">Vial</a> are keyboard configuration
          tools that use a special JSON format. VIA format wraps KLE layout data with additional
          metadata like keyboard name, vendor/product IDs, and matrix configuration.
        </p>
        <p>
          It also uses special label format which maps physical arrangment of keys to the switch
          matrix co-ordinates. To learn more visit
          <a href="https://www.caniusevia.com/docs/layouts" target="_blank"> VIA specification</a>.
        </p>
        <p>
          When you import a VIA file, kle-ng converts it to KLE format and preserves the
          VIA-specific metadata in this field. This allows you to edit the layout and export it back
          to VIA format later.
        </p>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-box-arrow-in-down"></i>
        Importing VIA Layouts
      </h6>
      <div class="help-content">
        <p>
          To import a VIA layout file (e.g., from the
          <a href="https://github.com/the-via/keyboards" target="_blank">VIA keyboards repository</a
          >):
        </p>
        <ol>
          <li>Click the <strong>Import</strong> button in the toolbar</li>
          <li>Select a VIA JSON file</li>
          <li>The layout will be displayed and VIA metadata will appear in this field</li>
        </ol>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-box-arrow-up"></i>
        Exporting to VIA Format
      </h6>
      <div class="help-content">
        <p>
          Layouts that contain VIA metadata can be exported back to VIA format for use with VIA/Vial
          configurators:
        </p>
        <ol>
          <li>Click the <strong>Export</strong> button in the toolbar</li>
          <li>Select <strong>Download VIA JSON</strong></li>
          <li>The file will contain your edited layout in VIA format</li>
        </ol>
        <p class="text-muted">
          <small
            >Note: The "Download VIA JSON" option is only available when VIA metadata is
            present.</small
          >
        </p>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">
        <i class="bi bi-code-square"></i>
        Editing VIA Metadata
      </h6>
      <div class="help-content">
        <p>
          The VIA metadata is stored as JSON. The editor validates your input in real-time. Invalid
          JSON will be highlighted with an error indicator.
        </p>

        <div class="warning-box">
          <div class="d-flex align-items-start gap-2">
            <i class="bi bi-exclamation-triangle-fill text-warning flex-shrink-0"></i>
            <div>
              <small>
                kle-ng does not validate the <b>content</b> of JSON. It is your responsibility to
                maintain VIA format convention as defined in the
                <a href="https://www.caniusevia.com/docs/specification" target="_blank"
                  >VIA specification</a
                >.
              </small>
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
          <li>Clearing the field will remove all VIA metadata from the layout</li>
          <li>
            VIA metadata is preserved when exporting to KLE format (in a compressed
            <code>_kleng_via_data</code> field)
          </li>
          <li>You can manually edit the metadata to customize keyboard information</li>
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
.warning-box {
  background: var(--bs-tertiary-bg);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--bs-warning);
  margin-top: 0.75rem;
}

.via-example-image {
  max-width: 200px;
  margin-left: 1rem;
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .via-example-image {
    float: none;
    display: block;
    margin: 0 auto 1rem;
    max-width: 100%;
  }
}
</style>

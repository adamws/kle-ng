<template>
  <BaseHelpModal :is-visible="isVisible" title="CSS Metadata - Help" @close="close">
    <div class="help-section">
      <h6 class="help-section-title">
        <BiInfoCircle />
        What is CSS Metadata?
      </h6>
      <div class="help-content">
        <p>
          The original
          <a href="https://www.keyboard-layout-editor.com/" target="_blank"
            >Keyboard Layout Editor</a
          >
          provided
          <a
            href="https://github.com/ijprest/keyboard-layout-editor/wiki/Custom-Styles"
            target="_blank"
            >fine-grained</a
          >
          control over keyboard CSS style via <code>css</code> metadata field defined in a layout.
        </p>
        <p>When you import a KLE layout, kle-ng displays that metadata value in this field.</p>
      </div>
    </div>

    <div class="help-section">
      <h6 class="help-section-title">
        <BiLightbulb />
        Supported CSS Features
      </h6>
      <div class="help-content">
        <p>The kle-ng supports only a minimal subset of CSS:</p>
        <ol>
          <li>
            <code>@import url(...);</code> - Loads external font stylesheet (e.g., Google Fonts)
          </li>
        </ol>

        <p>
          The font name is automatically extracted from the URL and applied globally to all canvas
          text. It is not possible to define different fonts for different key labels.
        </p>
        <p>All other CSS expressions are ignored and have no effect.</p>
      </div>
    </div>
  </BaseHelpModal>
</template>

<script setup lang="ts">
import BaseHelpModal from './BaseHelpModal.vue'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiLightbulb from 'bootstrap-icons/icons/lightbulb.svg'

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

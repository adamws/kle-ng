<template>
  <footer id="footer" class="app-footer py-4 mt-auto border-top">
    <div class="container">
      <div class="row">
        <div class="col-md-6">
          <div><strong>Keyboard Layout Editor NG (test)</strong> v{{ version }}</div>
          Successor of
          <a
            href="https://www.keyboard-layout-editor.com/"
            target="_blank"
            class="text-decoration-none"
            >Keyboard Layout Editor
          </a>
        </div>
        <div class="col-md-6 text-end">
          <div class="footer-links">
            <a href="https://github.com/adamws/kle-ng" target="_blank" class="text-decoration-none">
              Project GitHub</a
            ><br />
            <a
              href="https://github.com/adamws/kle-ng/issues"
              target="_blank"
              class="text-decoration-none"
            >
              Report Issues</a
            ><br />
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import packageJson from '../../package.json'

// Get version from package.json
const version = packageJson.version
</script>

<style scoped>
/* Footer theme support */
.app-footer {
  background-color: var(--bs-tertiary-bg);
  color: var(--bs-body-color);
  margin-top: auto; /* Push footer to bottom */
}

/* Responsive adjustments */
@media (max-width: 767.98px) {
  .col-md-6.text-end {
    text-align: start !important;
    margin-top: 1rem;
  }

  .footer-links a {
    display: inline-block;
    margin-right: 1rem;
    margin-bottom: 0.25rem;
  }
}
</style>

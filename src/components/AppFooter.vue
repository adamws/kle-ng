<template>
  <footer id="footer" class="bg-light py-4 mt-auto border-top">
    <div class="container">
      <div class="row">
        <div class="col-md-6">
          <div class="text-muted"><strong>Keyboard Layout Editor NG</strong> v{{ version }}</div>
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
              href="https://github.com/ijprest/keyboard-layout-editor/issues"
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
.footer-links a {
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.6;
}

.footer-links a:hover {
  color: var(--kle-primary);
}

.text-muted {
  font-size: 0.9rem;
  line-height: 1.6;
}

#footer {
  margin-top: auto; /* Push footer to bottom */
  border-top: 1px solid var(--kle-border);
  background-color: var(--kle-light) !important;
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

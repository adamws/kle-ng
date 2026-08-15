<template>
  <footer id="footer" class="app-footer py-4 mt-auto border-top">
    <div class="container">
      <div class="row">
        <div class="col-md-6">
          <div>
            <strong>Keyboard Layout Editor NG</strong>{{ ' ' }}
            <a
              :href="versionUrl"
              target="_blank"
              class="text-decoration-none"
              :title="versionTitle"
            >
              {{ versionText }}
            </a>
          </div>
          Successor of
          <a
            href="https://www.keyboard-layout-editor.com/"
            target="_blank"
            class="text-decoration-none"
            >Keyboard Layout Editor
          </a>
          <br />
          <a href="https://keyboard-tools.xyz" target="_blank" class="text-decoration-none">
            keyboard-tools.xyz</a
          >
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
            <a href="https://ko-fi.com/adamws" target="_blank" class="text-decoration-none">
              Support</a
            ><br />
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import packageJson from '../../package.json'
import { GITHUB_REPO_URL, commitUrl, shortSha } from '@/config/deployment'

// Get version from package.json
const version = packageJson.version

// Preview builds point at the exact commit they were built from, everything else at the
// release matching package.json (see src/config/deployment.ts)
const versionUrl = computed(() => commitUrl ?? `${GITHUB_REPO_URL}/releases/tag/v${version}`)

const versionText = computed(() => (commitUrl ? `v${version} (${shortSha})` : `v${version}`))

const versionTitle = computed(() =>
  commitUrl ? `View commit ${shortSha} on GitHub` : `View release v${version} on GitHub`,
)
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

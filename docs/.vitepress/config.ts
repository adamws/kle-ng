import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'KLE-NG Documentation',
  description: 'User documentation for Keyboard Layout Editor NG',

  base: '/docs/',
  outDir: '../dist/docs',

  head: [
    ['link', { rel: 'icon', href: '/docs/favicon.ico' }],
    [
      'script',
      {
        defer: '',
        src: 'https://cloud.umami.is/script.js',
        'data-website-id': '4e25208b-5f07-4aca-b8fc-15cd6f487a5a',
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Open Editor', link: 'https://editor.keyboard-tools.xyz/', target: '_blank' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Getting Started', link: '/getting-started' },
        ],
      },
      {
        text: 'Keyboard editing',
        items: [
          { text: 'Layout Editor', link: '/layout-editor' },
          { text: 'Key Properties', link: '/key-properties' },
          { text: 'Keyboard Metadata', link: '/keyboard-metadata' },
          { text: 'Keyboard Summary', link: '/keyboard-summary' },
          { text: 'Import & Export', link: '/import-export' },
        ],
      },
      {
        text: 'Generators',
        items: [
          { text: 'Plate Generator', link: '/plate-generator' },
          { text: 'PCB Generator', link: '/pcb-generator' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Custom Fonts & CSS', link: '/custom-fonts' },
          { text: 'Color Themes', link: '/color-themes' },
          { text: 'VIA & Vial Format', link: '/via-and-metadata' },
          { text: 'KLE Compatibility', link: '/compatibility' },
        ],
      },
      {
        text: 'Development',
        collapsed: true,
        items: [
          { text: 'Development Setup', link: '/development/development-setup' },
          { text: 'Authentication', link: '/development/authentication' },
          { text: 'Canvas Rendering Pipeline', link: '/development/canvas-rendering-pipeline' },
          { text: 'Color Theme Tool', link: '/development/color-theme-tool' },
          { text: 'Layout Export', link: '/development/layout-export' },
          { text: 'Matrix Annotation', link: '/development/matrix-annotation' },
          { text: 'Plate Generator', link: '/development/plate-generator' },
          { text: 'PCB Generator', link: '/development/pcb-generator' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/adamws/kle-ng/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/adamws/kle-ng' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Keyboard Layout Editor NG',
    },
  },
})

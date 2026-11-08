// svgo configuration for the footprint preview SVGs (used by generate.sh).
//
// Uses svgo's default preset for cleanup + pretty-printing, but keeps each pad
// a SEPARATE <path>. The default `mergePaths` plugin would collapse all pads
// into a single path, which breaks the per-element hover in the PCB Generator
// preview (each pad/pin needs to stay its own hoverable target).
export default {
  js2svg: { pretty: true, indent: 2 },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          mergePaths: false,
        },
      },
    },
  ],
}

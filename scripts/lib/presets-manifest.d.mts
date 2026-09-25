// Hand-written declarations for presets-manifest.mjs.
//
// The script is plain ESM outside the tsconfig include globs, but the vitest spec
// imports it by specifier, so it needs types. Keep these in step with the JSDoc in
// the .mjs — nothing generates one from the other.

export interface PresetDirScan {
  flat: { id: string; file: string }[]
  multilingual: { id: string; codes: string[] }[]
}

export interface ManifestLanguage {
  code: string
  name: string
  file: string
}

export interface ManifestEntry {
  id: string
  name: string
  file?: string
  defaultLanguage?: string
  languages?: ManifestLanguage[]
  description?: string
  keywords?: string[]
}

export interface Manifest {
  presets: ManifestEntry[]
}

export function scanPresetDir(rootDir: string): PresetDirScan

export function buildManifest(
  scan: PresetDirScan,
  previous: Manifest,
  languageNames: Record<string, string>,
  options?: { warn?: (message: string) => void },
): Manifest

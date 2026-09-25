import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { Serial } from '@adamws/kle-serial'
import { useKeyboardStore } from '@/stores/keyboard'
// The generator's own scan, so "what is on disk" has exactly one definition here and
// in scripts/generate-presets-manifest.mjs.
import { buildManifest, scanPresetDir } from '../../../scripts/lib/presets-manifest.mjs'
import committedManifest from '@/data/presets.json'
import languageNames from '../../../scripts/data/language-names.json'
import {
  ALL_PRESETS,
  TOP_PRESETS,
  TOP_PRESET_IDS,
  applyPreset,
  clearPresetCache,
  defaultLanguageOf,
  fetchPresetData,
  isMultilingual,
  presetFilename,
  presetLanguages,
  presetPayload,
  presetUrl,
  type Preset,
} from '../presets'

// Deliberately no vi.mock of presets.json: the catalogue assertions below only mean
// something against the real manifest.

const PRESET_DIR = resolve(__dirname, '../../../public/data/presets')

/** Every payload path the manifest references, flat and per-language alike. */
const manifestPayloads = (preset: Preset): string[] =>
  isMultilingual(preset) ? presetLanguages(preset).map((l) => l.file) : [preset.file!]

describe('preset catalogue', () => {
  beforeEach(() => {
    clearPresetCache()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('the curated shortlist', () => {
    // The shortlist names files rather than carrying a flag in the manifest, so a
    // rename there would silently drop an entry from the Import menu. This is the
    // check that turns that into a failing build instead.
    it('resolves every promoted id, in the order it promotes them', () => {
      expect(TOP_PRESETS.map((preset) => preset.id)).toEqual([...TOP_PRESET_IDS])
    })
  })

  describe('the manifest and the payloads on disk', () => {
    const scan = () => scanPresetDir(PRESET_DIR)

    const filesOnDisk = () => {
      const { flat, multilingual } = scan()
      return [
        ...flat.map((entry) => entry.file),
        ...multilingual.flatMap((entry) => entry.codes.map((code) => `${entry.id}/${code}.json`)),
      ]
    }

    it('names only files that exist', () => {
      const missing = ALL_PRESETS.flatMap(manifestPayloads).filter(
        (file) => !existsSync(resolve(PRESET_DIR, file)),
      )
      expect(missing).toEqual([])
    })

    // Four payloads sat here unreachable for years because nobody registered them.
    // Asserting the reverse direction too means the next one is caught immediately.
    it('leaves no payload unregistered', () => {
      const registered = new Set(ALL_PRESETS.flatMap(manifestPayloads))
      const orphans = filesOnDisk().filter((name) => !registered.has(name))
      expect(orphans).toEqual([])
    })

    it('uses each name and each id exactly once', () => {
      expect(new Set(ALL_PRESETS.map((p) => p.id)).size).toBe(ALL_PRESETS.length)
      expect(new Set(ALL_PRESETS.map((p) => p.name)).size).toBe(ALL_PRESETS.length)
    })

    // Languages are discovered from the directory at build time, not declared by
    // hand, so a payload dropped in without running `npm run generate:presets` would
    // otherwise simply never appear in the app — no error, no missing file, nothing
    // to notice. Feeding the committed manifest back in as the editorial source makes
    // this a pure staleness check: hand-written prose survives by construction, while
    // an unregistered language shows up as an extra `languages[]` entry.
    it('matches what the generator would write', () => {
      expect(buildManifest(scan(), committedManifest, languageNames)).toEqual(committedManifest)
    })

    // A preset is a physical board: its languages change the legends, never the keys.
    // This is what the card preview relies on when it draws only the default language,
    // and what the picker promises the user. It is also the guard against pasting an
    // xkbprint payload straight in — that generator emits a different ANSI geometry
    // (rx/ry rotation clusters, "Bksp", "Super", a 1.5u Ctrl), which would otherwise
    // land silently and only show up as a preview that does not match what loads.
    it('keeps every language of a preset on the same geometry', () => {
      const fingerprint = (file: string) =>
        Serial.deserialize(JSON.parse(readFileSync(resolve(PRESET_DIR, file), 'utf-8'))).keys.map(
          (key) =>
            [
              key.x,
              key.y,
              key.width,
              key.height,
              key.x2,
              key.y2,
              key.width2,
              key.height2,
              key.rotation_x,
              key.rotation_y,
              key.rotation_angle,
              key.stepped,
              key.decal,
              key.ghost,
              key.color,
              key.profile,
            ].join('|'),
        )

      for (const preset of ALL_PRESETS.filter(isMultilingual)) {
        const baseline = fingerprint(defaultLanguageOf(preset)!.file)
        for (const language of presetLanguages(preset)) {
          expect(fingerprint(language.file), `${preset.id} / ${language.code}`).toEqual(baseline)
        }
      }
    })
  })

  describe('languages', () => {
    const flat: Preset = { id: 'iso-105', name: 'ISO 105', file: 'iso-105.json' }
    const multi: Preset = {
      id: 'ansi-104',
      name: 'ANSI 104',
      defaultLanguage: 'pl',
      languages: [
        { code: 'en', name: 'English', file: 'ansi-104/en.json' },
        { code: 'pl', name: 'Polish', file: 'ansi-104/pl.json' },
      ],
    }

    it('treats only a preset with a languages array as multilingual', () => {
      expect(isMultilingual(flat)).toBe(false)
      expect(isMultilingual(multi)).toBe(true)
      expect(presetLanguages(flat)).toEqual([])
    })

    it('resolves the payload for a requested language', () => {
      expect(presetPayload(multi, 'en')).toBe('ansi-104/en.json')
      expect(presetPayload(flat)).toBe('iso-105.json')
    })

    // A stale share link or a hand-typed code should still load the board.
    it('falls back to the default language for an unknown code', () => {
      expect(presetPayload(multi, 'zz')).toBe('ansi-104/pl.json')
      expect(presetPayload(multi)).toBe('ansi-104/pl.json')
    })

    it('falls back to the first language when no default is named', () => {
      expect(defaultLanguageOf({ ...multi, defaultLanguage: undefined })?.code).toBe('en')
    })
  })

  describe('presetFilename', () => {
    it('strips the extension', () => {
      expect(presetFilename('ansi-104.json')).toBe('ansi-104')
      expect(presetFilename('multilayout-60-via.json')).toBe('multilayout-60-via')
    })

    // A slash would end up in the download name. The language is always suffixed,
    // the default included, so the name never changes shape with the choice.
    it('flattens a language payload path', () => {
      expect(presetFilename('ansi-104/pl.json')).toBe('ansi-104-pl')
      expect(presetFilename('ansi-104/en.json')).toBe('ansi-104-en')
    })
  })

  describe('fetchPresetData', () => {
    it('downloads a preset once per session', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([['A']]),
      } as Response)
      vi.stubGlobal('fetch', fetchMock)

      await fetchPresetData('ansi-104.json')
      await fetchPresetData('ansi-104.json')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(presetUrl('ansi-104.json'))

      clearPresetCache()
      await fetchPresetData('ansi-104.json')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not cache a failure', async () => {
      // A dropped connection must not make the preset unusable for the rest of the
      // session — the next click has to be able to try again.
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([['A']]) } as Response)
      vi.stubGlobal('fetch', fetchMock)

      await expect(fetchPresetData('ansi-104.json')).rejects.toThrow('network down')
      await expect(fetchPresetData('ansi-104.json')).resolves.toEqual([['A']])
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('rejects on a non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' } as Response),
      )

      await expect(fetchPresetData('ansi-104.json')).rejects.toThrow('HTTP 404')
    })
  })

  describe('applyPreset', () => {
    it('loads the payload and names the download after it', async () => {
      const payload = [['A']]
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) } as Response),
      )

      const store = useKeyboardStore()
      store.filename = 'something-loaded-earlier'
      const loadSpy = vi.spyOn(store, 'loadKLELayout')

      await applyPreset({ id: 'ansi-104', name: 'ANSI 104', file: 'ansi-104.json' }, store)

      expect(loadSpy).toHaveBeenCalledWith(payload)
      // loadKeyboard() clears the filename, so this is only right if applyPreset
      // assigns it afterwards.
      expect(store.filename).toBe('ansi-104')
    })

    it('loads the requested language and names the download after it', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: () => Promise.resolve([['A']]) } as Response)
      vi.stubGlobal('fetch', fetchMock)

      const store = useKeyboardStore()
      const preset = ALL_PRESETS.find((p) => p.id === 'ansi-104')!

      await applyPreset(preset, store, 'pl')

      expect(fetchMock).toHaveBeenCalledWith(presetUrl('ansi-104/pl.json'))
      expect(store.filename).toBe('ansi-104-pl')
    })

    // The Import dropdown's one-click shortcut goes through this path: no language,
    // no picker, just the default.
    it('falls back to the default language when none is given', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: () => Promise.resolve([['A']]) } as Response)
      vi.stubGlobal('fetch', fetchMock)

      const store = useKeyboardStore()
      await applyPreset(
        ALL_PRESETS.find((p) => p.id === 'ansi-104')!,
        store,
      )

      expect(fetchMock).toHaveBeenCalledWith(presetUrl('ansi-104/en.json'))
      expect(store.filename).toBe('ansi-104-en')
    })

    it('propagates a download failure to the caller', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

      await expect(
        applyPreset(
          { id: 'ansi-104', name: 'ANSI 104', file: 'ansi-104.json' },
          useKeyboardStore(),
        ),
      ).rejects.toThrow('network down')
    })
  })
})

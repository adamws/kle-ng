import { describe, it, expect } from 'vitest'
import { validatePlateSettingsJson } from '../plate-settings-validator'
import type { ValidationResult } from '../plate-settings-validator'

function warnings(r: ValidationResult): string[] {
  return r.valid ? r.warnings : []
}

describe('validatePlateSettingsJson', () => {
  describe('parsing', () => {
    it('accepts empty object', () => {
      const r = validatePlateSettingsJson('{}')
      expect(r.valid).toBe(true)
    })

    it('rejects invalid JSON', () => {
      const r = validatePlateSettingsJson('{bad json}')
      expect(r.valid).toBe(false)
    })

    it('rejects JSON array at root', () => {
      expect(validatePlateSettingsJson('[]')).toMatchObject({
        valid: false,
        error: expect.stringMatching(/object/),
      })
    })

    it('rejects JSON null at root', () => {
      expect(validatePlateSettingsJson('null').valid).toBe(false)
    })

    it('rejects JSON string at root', () => {
      expect(validatePlateSettingsJson('"hello"').valid).toBe(false)
    })
  })

  describe('old format detection', () => {
    it('rejects old format with top-level cutoutType', () => {
      expect(
        validatePlateSettingsJson(JSON.stringify({ cutoutType: 'cherry-mx-basic' })),
      ).toMatchObject({ valid: false, error: expect.stringMatching(/older settings format/) })
    })
  })

  describe('cutout section', () => {
    it('rejects non-object cutout', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ cutout: 42 })).valid).toBe(false)
    })

    it('rejects invalid switchType', () => {
      expect(
        validatePlateSettingsJson(JSON.stringify({ cutout: { switchType: 'unknown' } })),
      ).toMatchObject({ valid: false, error: expect.stringMatching(/switchType/) })
    })

    it('accepts all valid switchType values', () => {
      for (const t of [
        'cherry-mx-basic',
        'cherry-mx-openable',
        'cherry-mx-alps-hybrid',
        'alps-skcm',
        'alps-skcp',
        'kailh-choc-cpg1350',
        'kailh-choc-cpg1232',
        'custom-rectangle',
      ]) {
        const r = validatePlateSettingsJson(JSON.stringify({ cutout: { switchType: t } }))
        expect(r.valid, `switchType ${t} should be valid`).toBe(true)
      }
    })

    it('rejects invalid stabilizerType', () => {
      expect(
        validatePlateSettingsJson(JSON.stringify({ cutout: { stabilizerType: 'bad' } })).valid,
      ).toBe(false)
    })

    it('rejects non-finite switchFilletRadius', () => {
      expect(
        validatePlateSettingsJson(JSON.stringify({ cutout: { switchFilletRadius: 'abc' } })).valid,
      ).toBe(false)
    })

    it('rejects non-number kerf', () => {
      expect(validatePlateSettingsJson('{"cutout":{"kerf":"abc"}}').valid).toBe(false)
    })

    it('rejects non-boolean merge', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ cutout: { merge: 1 } }))).toMatchObject({
        valid: false,
        error: expect.stringMatching(/merge.*boolean/),
      })
    })

    it('accepts boolean merge', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ cutout: { merge: true } })).valid).toBe(
        true,
      )
    })

    it('rejects non-number width even when switchType is not custom-rectangle', () => {
      expect(
        validatePlateSettingsJson(
          JSON.stringify({ cutout: { switchType: 'cherry-mx-basic', width: 'not-a-number' } }),
        ),
      ).toMatchObject({ valid: false, error: expect.stringMatching(/cutout\.width/) })
    })

    it('rejects non-number height even when switchType is absent', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ cutout: { height: 'x' } })).valid).toBe(
        false,
      )
    })

    it('warns about unknown cutout fields', () => {
      const r = validatePlateSettingsJson(JSON.stringify({ cutout: { unknownField: 1 } }))
      expect(r.valid).toBe(true)
      expect(warnings(r).some((w) => w.includes('cutout.unknownField'))).toBe(true)
    })
  })

  describe('thickness', () => {
    it('rejects non-finite thickness', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ thickness: 'abc' })).valid).toBe(false)
    })

    it('accepts numeric thickness', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ thickness: 1.5 })).valid).toBe(true)
    })
  })

  describe('outline section', () => {
    it('rejects non-object outline', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ outline: 'none' })).valid).toBe(false)
    })

    it('rejects missing outlineType', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ outline: {} })).valid).toBe(false)
    })

    it('rejects invalid outlineType', () => {
      expect(
        validatePlateSettingsJson(JSON.stringify({ outline: { outlineType: 'circle' } })).valid,
      ).toBe(false)
    })

    it('accepts rectangular outline with all fields', () => {
      expect(
        validatePlateSettingsJson(
          JSON.stringify({
            outline: {
              outlineType: 'rectangular',
              marginTop: 5,
              marginBottom: 5,
              marginLeft: 5,
              marginRight: 5,
              filletRadius: 1,
              mergeWithCutouts: true,
            },
          }),
        ).valid,
      ).toBe(true)
    })

    it('rejects non-boolean mergeWithCutouts in rectangular outline', () => {
      expect(
        validatePlateSettingsJson(
          JSON.stringify({ outline: { outlineType: 'rectangular', mergeWithCutouts: 0 } }),
        ),
      ).toMatchObject({ valid: false, error: expect.stringMatching(/mergeWithCutouts.*boolean/) })
    })

    it('rejects non-boolean mergeWithCutouts in tight outline', () => {
      expect(
        validatePlateSettingsJson(
          JSON.stringify({ outline: { outlineType: 'tight', mergeWithCutouts: 'yes' } }),
        ).valid,
      ).toBe(false)
    })

    it('rejects non-number marginTop', () => {
      expect(
        validatePlateSettingsJson(
          JSON.stringify({ outline: { outlineType: 'rectangular', marginTop: 'abc' } }),
        ).valid,
      ).toBe(false)
    })

    it('warns about unknown outline fields', () => {
      const r = validatePlateSettingsJson(
        JSON.stringify({ outline: { outlineType: 'none', extra: 1 } }),
      )
      expect(r.valid).toBe(true)
      expect(warnings(r).some((w) => w.includes('outline.extra'))).toBe(true)
    })
  })

  describe('holes section', () => {
    it('rejects non-object holes', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ holes: [] })).valid).toBe(false)
    })

    it('accepts empty holes object', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ holes: {} })).valid).toBe(true)
    })

    it('accepts holes.custom as empty array', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ holes: { custom: [] } })).valid).toBe(true)
    })

    it('rejects holes.custom as non-array', () => {
      expect(validatePlateSettingsJson(JSON.stringify({ holes: { custom: {} } })).valid).toBe(false)
    })

    it('rejects custom hole with non-number diameter', () => {
      expect(
        validatePlateSettingsJson(
          JSON.stringify({ holes: { custom: [{ diameter: 'x', offsetX: 0, offsetY: 0 }] } }),
        ),
      ).toMatchObject({
        valid: false,
        error: expect.stringMatching(/holes\.custom\[0\]\.diameter/),
      })
    })

    it('rejects custom hole missing required fields', () => {
      expect(
        validatePlateSettingsJson(JSON.stringify({ holes: { custom: [{ diameter: 3 }] } })).valid,
      ).toBe(false)
    })

    it('rejects non-number mounting diameter', () => {
      expect(
        validatePlateSettingsJson(JSON.stringify({ holes: { mounting: { diameter: 'big' } } }))
          .valid,
      ).toBe(false)
    })

    it('warns about unknown holes fields', () => {
      const r = validatePlateSettingsJson(JSON.stringify({ holes: { unknown: 1 } }))
      expect(r.valid).toBe(true)
      expect(warnings(r).some((w) => w.includes('holes.unknown'))).toBe(true)
    })
  })

  describe('unknown top-level fields', () => {
    it('warns but does not fail on unknown top-level key', () => {
      const r = validatePlateSettingsJson(JSON.stringify({ extra: 'field' }))
      expect(r.valid).toBe(true)
      expect(warnings(r).some((w) => w.includes('extra'))).toBe(true)
    })
  })
})

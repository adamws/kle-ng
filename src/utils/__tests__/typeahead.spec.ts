import { describe, it, expect } from 'vitest'
import { foldForTypeahead, isTypeaheadKey, typeaheadIndex } from '../typeahead'

const LANGUAGES = [
  { label: 'English', alias: 'en' },
  { label: 'British English', alias: 'en-GB' },
  { label: 'Māori', alias: 'mi' },
  { label: 'Persian', alias: 'fa' },
  { label: 'Polish', alias: 'pl' },
  { label: 'Serbian', alias: 'sr' },
  { label: 'Sinhala', alias: 'si' },
  { label: 'Slovak', alias: 'sk' },
]
const indexOf = (label: string) => LANGUAGES.findIndex((item) => item.label === label)

const key = (key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, ...init })

describe('typeaheadIndex', () => {
  it('jumps to the first option starting with a letter', () => {
    expect(typeaheadIndex(LANGUAGES, 'p', 0)).toBe(indexOf('Persian'))
  })

  it('narrows as more letters are typed', () => {
    // "p" landed on Persian; "po" moves on because Persian no longer matches.
    expect(typeaheadIndex(LANGUAGES, 'po', indexOf('Persian'))).toBe(indexOf('Polish'))
  })

  it('keeps focus where it is while the current option still matches', () => {
    expect(typeaheadIndex(LANGUAGES, 'pe', indexOf('Persian'))).toBe(indexOf('Persian'))
  })

  it('cycles through the matches when one letter is pressed repeatedly', () => {
    expect(typeaheadIndex(LANGUAGES, 's', 0)).toBe(indexOf('Serbian'))
    expect(typeaheadIndex(LANGUAGES, 'ss', indexOf('Serbian'))).toBe(indexOf('Sinhala'))
    expect(typeaheadIndex(LANGUAGES, 'sss', indexOf('Sinhala'))).toBe(indexOf('Slovak'))
  })

  it('wraps around the end of the list', () => {
    expect(typeaheadIndex(LANGUAGES, 's', indexOf('Slovak'))).toBe(indexOf('Serbian'))
    expect(typeaheadIndex(LANGUAGES, 'e', indexOf('Slovak'))).toBe(indexOf('English'))
  })

  it('ignores case and diacritics', () => {
    expect(typeaheadIndex(LANGUAGES, 'MA', 0)).toBe(indexOf('Māori'))
  })

  it('matches multi-word labels, spaces included', () => {
    expect(typeaheadIndex(LANGUAGES, 'british e', 0)).toBe(indexOf('British English'))
  })

  it('falls back to the alias only when no label matches', () => {
    // No name starts with "pl", so the code finds Polish.
    expect(typeaheadIndex(LANGUAGES, 'pl', 0)).toBe(indexOf('Polish'))
    // "en-" starts no name, so en-GB's code wins over English.
    expect(typeaheadIndex(LANGUAGES, 'en-', 0)).toBe(indexOf('British English'))
    // "en" starts the name "English", so the name wins.
    expect(typeaheadIndex(LANGUAGES, 'en', indexOf('Slovak'))).toBe(indexOf('English'))
  })

  it('returns -1 when nothing matches', () => {
    expect(typeaheadIndex(LANGUAGES, 'zz', 0)).toBe(-1)
    expect(typeaheadIndex([], 'a', 0)).toBe(-1)
  })

  it('handles a menu with nothing focused yet', () => {
    expect(typeaheadIndex(LANGUAGES, 'po', -1)).toBe(indexOf('Polish'))
  })
})

describe('isTypeaheadKey', () => {
  it('accepts a printable character', () => {
    expect(isTypeaheadKey(key('p'), true)).toBe(true)
    expect(isTypeaheadKey(key('Ł'), true)).toBe(true)
  })

  it('leaves commands and modifier chords alone', () => {
    for (const name of ['Enter', 'ArrowDown', 'Tab', 'Escape', 'Dead']) {
      expect(isTypeaheadKey(key(name), true)).toBe(false)
    }
    expect(isTypeaheadKey(key('p', { ctrlKey: true }), true)).toBe(false)
    expect(isTypeaheadKey(key('p', { metaKey: true }), true)).toBe(false)
    expect(isTypeaheadKey(key('p', { altKey: true }), true)).toBe(false)
  })

  it('treats Space as activation unless a word is being typed', () => {
    expect(isTypeaheadKey(key(' '), true)).toBe(false)
    expect(isTypeaheadKey(key(' '), false)).toBe(true)
  })
})

describe('foldForTypeahead', () => {
  it('drops diacritics and case', () => {
    expect(foldForTypeahead('Māori')).toBe('maori')
    expect(foldForTypeahead('Ńko')).toBe('nko')
  })
})

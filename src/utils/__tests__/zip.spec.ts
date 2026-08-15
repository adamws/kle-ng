import { describe, it, expect } from 'vitest'
import { createZip, crc32, type ZipEntry } from '../zip'

const FIXED = new Date(2026, 7, 15, 14, 30, 44)

const u32 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer).getUint32(at, true)
const u16 = (bytes: Uint8Array, at: number) => new DataView(bytes.buffer).getUint16(at, true)

/**
 * Read the archive back the way an unzipper does: find the end-of-central-directory
 * record, walk the central directory, and follow each entry's recorded offset to its
 * local header. That exercises the offsets and sizes rather than trusting them, which
 * is the part most easily got wrong.
 */
const readZip = (archive: Uint8Array) => {
  const eocdAt = archive.length - 22
  expect(u32(archive, eocdAt)).toBe(0x06054b50)

  const count = u16(archive, eocdAt + 10)
  const centralSize = u32(archive, eocdAt + 12)
  let at = u32(archive, eocdAt + 16)
  expect(at + centralSize).toBe(eocdAt)

  const decoder = new TextDecoder()
  const entries: Array<{ name: string; text: string; crc: number; method: number; flags: number }> =
    []

  for (let i = 0; i < count; i += 1) {
    expect(u32(archive, at)).toBe(0x02014b50)
    const flags = u16(archive, at + 8)
    const method = u16(archive, at + 10)
    const crc = u32(archive, at + 16)
    const size = u32(archive, at + 24)
    const nameLength = u16(archive, at + 28)
    const name = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength))
    const localAt = u32(archive, at + 42)

    // …and the local header the central directory points at must agree with it
    expect(u32(archive, localAt)).toBe(0x04034b50)
    expect(u32(archive, localAt + 14)).toBe(crc)
    expect(u32(archive, localAt + 22)).toBe(size)
    const localNameLength = u16(archive, localAt + 26)
    const extraLength = u16(archive, localAt + 28)
    expect(decoder.decode(archive.subarray(localAt + 30, localAt + 30 + localNameLength))).toBe(
      name,
    )

    const dataAt = localAt + 30 + localNameLength + extraLength
    entries.push({
      name,
      text: decoder.decode(archive.subarray(dataAt, dataAt + size)),
      crc,
      method,
      flags,
    })
    at += 46 + nameLength + u16(archive, at + 30) + u16(archive, at + 32)
  }

  return entries
}

describe('crc32', () => {
  // Published check values for CRC-32/ISO-HDLC
  it.each([
    ['', 0x00000000],
    ['a', 0xe8b7be43],
    ['123456789', 0xcbf43926],
    ['The quick brown fox jumps over the lazy dog', 0x414fa339],
  ])('matches the published value for %j', (input, expected) => {
    expect(crc32(new TextEncoder().encode(input))).toBe(expected)
  })
})

describe('createZip', () => {
  const entries: ZipEntry[] = [
    { name: 'Planck rev6.json', text: '{"name":"Planck rev6"}' },
    { name: 'empty.json', text: '' },
    // Non-ASCII names are why the UTF-8 flag is set
    { name: 'Ergonomiczna klawiatura – wersja ż.json', text: '{"ok":true}' },
  ]

  it('round-trips every entry through the central directory', () => {
    const read = readZip(createZip(entries, FIXED))

    expect(read.map((e) => e.name)).toEqual(entries.map((e) => e.name))
    expect(read.map((e) => e.text)).toEqual(entries.map((e) => e.text))
  })

  it('stores rather than compresses, and flags names as UTF-8', () => {
    for (const entry of readZip(createZip(entries, FIXED))) {
      expect(entry.method).toBe(0)
      expect(entry.flags & 0x0800).toBe(0x0800)
    }
  })

  it('checksums the data it stored', () => {
    const encoder = new TextEncoder()
    for (const entry of readZip(createZip(entries, FIXED))) {
      expect(entry.crc).toBe(crc32(encoder.encode(entry.text)))
    }
  })

  it('writes the timestamp in MS-DOS form, to the nearest two seconds', () => {
    const archive = createZip([entries[0]!], FIXED)
    // Local header carries time at +10 and date at +12
    expect(u16(archive, 10)).toBe((14 << 11) | (30 << 5) | (44 >> 1))
    expect(u16(archive, 12)).toBe(((2026 - 1980) << 9) | (8 << 5) | 15)
  })

  it('is byte-for-byte reproducible for the same input and timestamp', () => {
    expect(createZip(entries, FIXED)).toEqual(createZip(entries, FIXED))
  })

  it('produces a readable empty archive', () => {
    const archive = createZip([], FIXED)
    expect(archive).toHaveLength(22)
    expect(u32(archive, 0)).toBe(0x06054b50)
    expect(readZip(archive)).toEqual([])
  })

  // ZIP64 is not implemented, so the cases needing it must fail loudly rather than
  // emit an archive whose central directory disagrees with its contents.
  it('refuses more entries than the format can count', () => {
    const tooMany = Array.from({ length: 0x10000 }, (_, i) => ({ name: `${i}.json`, text: '' }))
    expect(() => createZip(tooMany, FIXED)).toThrow(RangeError)
  })
})

#!/usr/bin/env node
/**
 * Build src/assets/fonts/kle-marks.woff2, the "KLE Marks" legend font.
 *
 *   npm i --no-save subset-font     # HarfBuzz subsetter; not a project dependency
 *   node scripts/generate-marks-font.mjs path/to/Andika-Regular.ttf
 *
 * Source: Andika Regular by SIL International (SIL Open Font License 1.1),
 * https://github.com/google/fonts/tree/main/ofl/andika. Andika is built for
 * diacritics: it positions every combining mark on U+25CC DOTTED CIRCLE, overlays
 * such as U+0338 (dead_stroke) included, which Noto Sans and common system
 * fallbacks do not.
 *
 * The subset keeps U+25CC and the Latin combining-mark blocks with all layout tables.
 * "Andika" is a Reserved Font Name under the OFL, and a subset is a Modified Version,
 * so the family is renamed to "KLE Marks" in the name table; the copyright, version and
 * license records are kept. Keep RANGES in step with the unicode-range in
 * src/assets/main.css.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const subsetFont = require('subset-font')
const fontverter = require('fontverter') // installed alongside subset-font

export const RANGES = [
  [0x25cc, 0x25cc],
  [0x0300, 0x036f],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe20, 0xfe2f],
]

const FAMILY = 'KLE Marks'
const RENAMED = {
  1: FAMILY,
  2: 'Regular',
  3: `${FAMILY} Regular`,
  4: `${FAMILY} Regular`,
  6: 'KLEMarks-Regular',
}
// Kept from the source: copyright, version, trademark notice, manufacturer, designer,
// description, URLs, license. Everything else (typographic family names and the like,
// which repeat the reserved name) is dropped.
const KEPT = new Set([0, 5, 7, 8, 9, 10, 11, 12, 13, 14])

const utf16be = (text) => {
  const buf = Buffer.alloc(text.length * 2)
  for (let i = 0; i < text.length; i++) buf.writeUInt16BE(text.charCodeAt(i), i * 2)
  return buf
}

const readTables = (font) => {
  const count = font.readUInt16BE(4)
  const tables = new Map()
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16
    const tag = font.toString('latin1', at, at + 4)
    const offset = font.readUInt32BE(at + 8)
    const length = font.readUInt32BE(at + 12)
    tables.set(tag, Buffer.from(font.subarray(offset, offset + length)))
  }
  return { version: font.readUInt32BE(0), tables }
}

/** A format-0 name table: kept Windows Unicode records plus the renamed ones. */
const renameTable = (name) => {
  const count = name.readUInt16BE(2)
  const storage = name.readUInt16BE(4)
  const records = []
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12
    const [platform, encoding, language, id, length, offset] = [0, 2, 4, 6, 8, 10].map((o) =>
      name.readUInt16BE(at + o),
    )
    if (platform !== 3 || encoding !== 1 || !KEPT.has(id)) continue
    const bytes = name.subarray(storage + offset, storage + offset + length)
    records.push({ language, id, bytes })
  }
  for (const [id, text] of Object.entries(RENAMED)) {
    records.push({ language: 0x409, id: Number(id), bytes: utf16be(text) })
  }
  records.sort((a, b) => a.language - b.language || a.id - b.id)

  const header = Buffer.alloc(6 + records.length * 12)
  header.writeUInt16BE(0, 0)
  header.writeUInt16BE(records.length, 2)
  header.writeUInt16BE(header.length, 4)
  let offset = 0
  records.forEach((r, i) => {
    const at = 6 + i * 12
    ;[3, 1, r.language, r.id, r.bytes.length, offset].forEach((v, k) =>
      header.writeUInt16BE(v, at + k * 2),
    )
    offset += r.bytes.length
  })
  return Buffer.concat([header, ...records.map((r) => r.bytes)])
}

const checksum = (buf) => {
  const padded = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)])
  let sum = 0
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0
  return sum
}

/** Reassembles an sfnt, recomputing table checksums and head.checkSumAdjustment. */
const writeFont = (version, tables) => {
  const tags = [...tables.keys()].sort()
  const count = tags.length
  const pow2 = 2 ** Math.floor(Math.log2(count))
  const dir = Buffer.alloc(12 + count * 16)
  dir.writeUInt32BE(version, 0)
  dir.writeUInt16BE(count, 4)
  dir.writeUInt16BE(pow2 * 16, 6)
  dir.writeUInt16BE(Math.log2(pow2), 8)
  dir.writeUInt16BE(count * 16 - pow2 * 16, 10)

  const head = tables.get('head')
  head.writeUInt32BE(0, 8) // checkSumAdjustment is computed over a zeroed field
  let offset = dir.length
  const bodies = []
  tags.forEach((tag, i) => {
    const data = tables.get(tag)
    const at = 12 + i * 16
    dir.write(tag, at, 'latin1')
    dir.writeUInt32BE(checksum(data), at + 4)
    dir.writeUInt32BE(offset, at + 8)
    dir.writeUInt32BE(data.length, at + 12)
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)])
    bodies.push(padded)
    offset += padded.length
  })
  const font = Buffer.concat([dir, ...bodies])
  const headAt =
    dir.length + bodies.slice(0, tags.indexOf('head')).reduce((n, b) => n + b.length, 0)
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headAt + 8)
  return font
}

async function main() {
  const source = process.argv[2]
  if (!source) {
    console.error('usage: node scripts/generate-marks-font.mjs path/to/Andika-Regular.ttf')
    process.exit(1)
  }
  let text = ''
  for (const [lo, hi] of RANGES) for (let c = lo; c <= hi; c++) text += String.fromCodePoint(c)

  // HarfBuzz keeps only name IDs 0-6 unless told otherwise; the OFL wants the license
  // records (13, 14) to travel with the font.
  const subset = await subsetFont(readFileSync(source), text, {
    targetFormat: 'truetype',
    preserveNameIds: [...KEPT],
  })
  const { version, tables } = readTables(subset)
  tables.set('name', renameTable(tables.get('name')))
  const woff2 = await fontverter.convert(writeFont(version, tables), 'woff2', 'truetype')

  const out = fileURLToPath(new URL('../src/assets/fonts/kle-marks.woff2', import.meta.url))
  writeFileSync(out, woff2)
  console.log(`wrote ${out} (${woff2.length} bytes)`)
}

await main()

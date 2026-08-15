/**
 * Minimal ZIP writer, stored (uncompressed) entries only.
 *
 * Exists so "Download all" in My Layouts can hand back one file containing one
 * ordinary .json per layout, each importable on its own. A dependency would be a
 * lot of surface for that: the archives here are a handful of small text files, and
 * compressing them buys little next to the JSON they hold.
 *
 * Deliberately not implemented, because nothing here needs it: compression methods
 * other than store, data descriptors, encryption, directory entries, and ZIP64. The
 * last of those is what bounds the format — see the guards in `createZip`.
 *
 * Layout of what this writes, per APPNOTE 4.3.6:
 *
 *   [local header][data] × n   [central directory header] × n   [end of central directory]
 */

const LOCAL_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_HEADER_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50

const LOCAL_HEADER_SIZE = 30
const CENTRAL_HEADER_SIZE = 46
const END_OF_CENTRAL_DIR_SIZE = 22

/** 2.0: the lowest version that specifies everything used here. */
const VERSION = 20
/** Bit 11 — names and comments are UTF-8, so non-ASCII layout names survive. */
const FLAG_UTF8_NAMES = 0x0800
/** Compression method 0. */
const METHOD_STORE = 0

const MAX_ENTRIES = 0xffff
const MAX_SIZE = 0xffffffff

const CRC_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value >>> 0
  }
  return table
})()

/** CRC-32/ISO-HDLC, the checksum every ZIP entry carries. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * MS-DOS date and time, which is what ZIP stores: two seconds of resolution, and no
 * year before 1980. Local time, with no zone recorded — the format has nowhere to put
 * one, so an archive opened in another zone shows the same wall clock.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

export interface ZipEntry {
  /** Path inside the archive. Written as UTF-8. */
  name: string
  /** File contents. Text only — everything this packs is JSON. */
  text: string
}

/**
 * Build a ZIP archive.
 *
 * @param modified timestamp recorded on every entry; defaults to now. Passing one
 *   makes the output deterministic, which is what the tests rely on.
 * @throws if the archive would need ZIP64 — more than 65,535 entries, or any entry
 *   (or the archive) at 4 GiB or more. Callers here cannot reach either: the saved
 *   layout quota is 5. Throwing beats silently writing an archive whose central
 *   directory disagrees with its contents.
 */
export function createZip(entries: ZipEntry[], modified = new Date()): Uint8Array<ArrayBuffer> {
  if (entries.length > MAX_ENTRIES) {
    throw new RangeError(`ZIP supports at most ${MAX_ENTRIES} entries without ZIP64`)
  }

  const encoder = new TextEncoder()
  const { time, date } = dosDateTime(modified)

  const parts: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let localBytes = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = encoder.encode(entry.text)
    if (data.length > MAX_SIZE) {
      throw new RangeError(`"${entry.name}" is too large for ZIP without ZIP64`)
    }
    const crc = crc32(data)

    const local = new Uint8Array(LOCAL_HEADER_SIZE + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, LOCAL_HEADER_SIGNATURE, true)
    localView.setUint16(4, VERSION, true)
    localView.setUint16(6, FLAG_UTF8_NAMES, true)
    localView.setUint16(8, METHOD_STORE, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true) // compressed size — stored, so equal
    localView.setUint32(22, data.length, true) // uncompressed size
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true) // no extra field
    local.set(name, LOCAL_HEADER_SIZE)

    const central = new Uint8Array(CENTRAL_HEADER_SIZE + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, CENTRAL_HEADER_SIGNATURE, true)
    centralView.setUint16(4, VERSION, true) // version made by
    centralView.setUint16(6, VERSION, true) // version needed
    centralView.setUint16(8, FLAG_UTF8_NAMES, true)
    centralView.setUint16(10, METHOD_STORE, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true) // extra field length
    centralView.setUint16(32, 0, true) // comment length
    centralView.setUint16(34, 0, true) // disk number start
    centralView.setUint16(36, 0, true) // internal attributes
    centralView.setUint32(38, 0, true) // external attributes
    centralView.setUint32(42, localBytes, true) // offset of the local header above
    central.set(name, CENTRAL_HEADER_SIZE)

    parts.push(local, data)
    centrals.push(central)
    localBytes += local.length + data.length
  }

  const centralBytes = centrals.reduce((total, part) => total + part.length, 0)
  if (localBytes + centralBytes + END_OF_CENTRAL_DIR_SIZE > MAX_SIZE) {
    throw new RangeError('archive is too large for ZIP without ZIP64')
  }

  const end = new Uint8Array(END_OF_CENTRAL_DIR_SIZE)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, END_OF_CENTRAL_DIR_SIGNATURE, true)
  endView.setUint16(4, 0, true) // this disk
  endView.setUint16(6, 0, true) // disk holding the central directory
  endView.setUint16(8, entries.length, true) // entries on this disk
  endView.setUint16(10, entries.length, true) // entries in total
  endView.setUint32(12, centralBytes, true)
  endView.setUint32(16, localBytes, true) // central directory starts after the data
  endView.setUint16(20, 0, true) // no archive comment

  parts.push(...centrals, end)

  // Backed by an explicit ArrayBuffer, so the result is a `Uint8Array<ArrayBuffer>`
  // and not the `ArrayBufferLike` flavour that a Blob will not accept.
  const archive = new Uint8Array(
    new ArrayBuffer(localBytes + centralBytes + END_OF_CENTRAL_DIR_SIZE),
  )
  let at = 0
  for (const part of parts) {
    archive.set(part, at)
    at += part.length
  }
  return archive
}

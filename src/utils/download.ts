/**
 * Saves a blob as a file download.
 *
 * The revoke is deferred rather than run in the same turn as `click()`: current
 * browsers snapshot the blob synchronously, but that is not guaranteed and revoking
 * immediately has historically raced the download handoff (Firefox, Safari). A
 * macrotask is enough — the navigation has been queued by then.
 *
 * One call per click: several downloads from one click trip Chrome's "download
 * multiple files" prompt and are dropped by Safari, so bundle files in a zip instead.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

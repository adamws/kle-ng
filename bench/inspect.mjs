#!/usr/bin/env node
import { createJiti } from 'jiti'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')

const jiti = createJiti(import.meta.url, {
  alias: { '@': resolve(root, 'src') },
})

await jiti.import('./inspect.ts')

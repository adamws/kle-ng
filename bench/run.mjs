#!/usr/bin/env node
// Wrapper that invokes bench/run.ts via jiti with the @/ alias resolved.
// package.json "bench" script points here.
import { createJiti } from 'jiti'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')

const jiti = createJiti(import.meta.url, {
  alias: { '@': resolve(root, 'src') },
})

await jiti.import('./run.ts')

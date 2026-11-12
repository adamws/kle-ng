// Predefined special key templates
// These are common special keys with non-rectangular or stepped shapes

import type { Array12 } from '@adamws/kle-serial'

export interface SpecialKeyTemplate {
  name: string
  description: string
  data: {
    width: number
    height: number
    width2?: number
    height2?: number
    x2?: number
    y2?: number
    stepped?: boolean
    labels?: Array12<string>
  }
}

export const SPECIAL_KEYS: SpecialKeyTemplate[] = [
  {
    name: 'ISO Enter',
    description: 'Standard ISO layout Enter key',
    data: {
      width: 1.25,
      height: 2,
      width2: 1.5,
      height2: 1,
      x2: -0.25,
      y2: 0,
      labels: ['', '', '', '', 'Enter', '', '', '', '', '', '', ''],
    },
  },
  {
    name: 'Big-Ass Enter',
    description: 'Large ANSI-style Enter key',
    data: {
      width: 1.5,
      height: 2,
      width2: 2.25,
      height2: 1,
      x2: -0.75,
      y2: 1,
      labels: ['', '', '', '', 'Enter', '', '', '', '', '', '', ''],
    },
  },
  {
    name: 'Stepped Caps Lock',
    description: 'Caps Lock with a 1.25U raised part on a 1.75U stepped keycap',
    data: {
      width: 1.25,
      height: 1,
      width2: 1.75,
      height2: 1,
      x2: 0,
      y2: 0,
      stepped: true,
      labels: ['', '', '', '', 'Caps Lock', '', '', '', '', '', '', ''],
    },
  },
]

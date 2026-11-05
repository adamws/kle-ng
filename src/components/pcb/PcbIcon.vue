<!--
  PcbIcon: the track editor's own icons, drawn on bootstrap-icons' 16 px grid
  in currentColor so they sit with them in buttons (pressed, disabled, dark):
  copper as 2 px strokes with round ends, pads and vias as rings around their
  hole (even-odd, so the button shows through).

  - route: a track with a 45° corner between two through-hole pads
  - via: a via with a track on each layer, the far layer's faded
  - posture-45 / posture-90: a track bending at that angle (an angle mark
    doesn't survive 16 px next to a 2 px track; the buttons say the angle)
-->
<script setup lang="ts">
defineProps<{ name: 'route' | 'via' | 'posture-45' | 'posture-90' }>()

/** A ring centred at (x, y): outer radius r, hole radius h (fill-rule evenodd). */
function ring(x: number, y: number, r: number, h: number): string {
  const circle = (rad: number) =>
    `M${x - rad} ${y}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0`
  return circle(r) + circle(h)
}
</script>

<template>
  <svg
    class="pcb-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <template v-if="name === 'route'">
      <path class="copper" d="M5.5 13H8l5-5V5.5" />
      <path :d="ring(3, 13, 2.5, 1)" fill-rule="evenodd" />
      <path :d="ring(13, 3, 2.5, 1)" fill-rule="evenodd" />
    </template>
    <template v-else-if="name === 'via'">
      <path class="copper" d="M1 8h3" />
      <path class="copper far" d="M12 8h3" />
      <path :d="ring(8, 8, 4, 1.75)" fill-rule="evenodd" />
    </template>
    <template v-else-if="name === 'posture-45'">
      <path class="copper" d="M2 13h5l6-6V2" />
    </template>
    <template v-else>
      <path class="copper" d="M2 13h11V2" />
    </template>
  </svg>
</template>

<style scoped>
.pcb-icon {
  flex-shrink: 0;
}

.copper {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* the other copper layer */
.far {
  opacity: 0.45;
}
</style>

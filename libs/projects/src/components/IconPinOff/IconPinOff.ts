import { createReactComponent } from '@tabler/icons-react';

/*
 * Tabler ships no crossed-out `IconPin`; its `IconPinnedOff` is the upright
 * pin. This is the design's "pinned-off" glyph: `IconPin` cut by the
 * `M3 3l18 18` slash, on Tabler's 24px grid so `size` and `stroke` behave
 * like every other Tabler icon.
 */
/** Crossed-out `IconPin`, shown on the Unpin action. */
export const IconPinOff = createReactComponent('outline', 'pin-off', 'PinOff', [
  ['path', { d: 'M3 3l18 18', key: 'svg-0' }],
  ['path', { d: 'M15 4.5l-3.25 3.25', key: 'svg-1' }],
  ['path', { d: 'M14.5 4l5.5 5.5', key: 'svg-2' }],
  ['path', { d: 'M16.25 12.25l3.25 -3.25', key: 'svg-3' }],
  ['path', { d: 'M9.18 9.18l-2.18 .82l-1.5 1.5l3.5 3.5', key: 'svg-4' }],
  ['path', { d: 'M14.82 14.82l-.82 2.18l-1.5 1.5l-3.5 -3.5', key: 'svg-5' }],
  ['path', { d: 'M9 15l-4.5 4.5', key: 'svg-6' }],
]);

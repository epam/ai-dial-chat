/** Document events that end a decorative copy: any live interaction with the page. */
export const COPY_INTERACTION_EVENTS: readonly string[] = [
  'scroll',
  'pointerdown',
  'focusin',
  'keydown',
  'beforeinput',
  'input',
  'compositionstart',
  'visibilitychange',
];

/** Returns a zero-size, inert layer at the host's origin, so a copy keeps its position and only its transform composes. */
export const makeTravelLayer = (): HTMLDivElement => {
  const layer = document.createElement('div');
  layer.inert = true;
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: '0px',
    height: '0px',
    overflow: 'visible',
    pointerEvents: 'none',
  });
  return layer;
};

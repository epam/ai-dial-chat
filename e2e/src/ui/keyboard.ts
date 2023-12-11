const isMac = process.platform === 'darwin';

export const keys = {
  enter: 'Enter',
  ctrlPlusA: isMac ? 'Meta+A' : 'Control+A',
  ctrlPlusV: isMac ? 'Meta+V' : 'Control+V',
  space: 'Space',
  arrowRight: 'ArrowRight',
  arrowLeft: 'ArrowLeft',
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
};

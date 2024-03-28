const isMac = process.platform === 'darwin';

export const keys = {
  enter: 'Enter',
  ctrlPlusA: isMac ? 'Meta+A' : 'Control+A',
  ctrlPlusC: isMac ? 'Meta+C' : 'Control+C',
  ctrlPlusV: isMac ? 'Meta+V' : 'Control+V',
  space: 'Space',
  arrowRight: 'ArrowRight',
  arrowLeft: 'ArrowLeft',
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
  delete: 'Delete',
};

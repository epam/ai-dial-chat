const isMac = process.platform === 'darwin';

export const keys = {
  enter: 'Enter',
  ctrlPlusA: isMac ? 'Meta+A' : 'Control+A',
};

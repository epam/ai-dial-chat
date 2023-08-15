const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

export const keys = {
  enter: 'Enter',
  ctrlPlusA: isMac ? 'Meta+A' : 'Control+A',
};

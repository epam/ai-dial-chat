export const createIsExternalPeerImport = (peerNames) => (id) => {
  if (id.endsWith('.css')) return false;
  return peerNames.some((name) => id === name || id.startsWith(`${name}/`));
};

export const toClientChannelFormat = <T extends object>(payload: T) => ({
  ...payload,
  jsonrpc: '2.0',
});

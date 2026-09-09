// Request start time owns the startup partition, even if a response arrives later.
export const collectStartupResponses = async (requests, readyAt) => {
  const completed = await Promise.all(requests.map(async request => {
    const response = await request.response();
    if (!response) throw new Error('Startup request failed: '+request.url());
    const startedAt = request.timing().startTime;
    if (!Number.isFinite(startedAt) || startedAt < 0) throw new Error('Missing request start time: '+request.url());
    return {response,startedAt};
  }));
  return completed.filter(item=>item.startedAt<=readyAt).map(item=>item.response);
};

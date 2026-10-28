/**
 * Parses one normalized `data: {...}` frame produced by the Responses adapter.
 * @param frame - SSE frame text
 */
export const parseChunkFrame = (frame: string): object | undefined => {
  const payload = frame.startsWith('data: ') ? frame.slice(6).trim() : '';
  if (!payload.startsWith('{')) return undefined;
  try {
    return JSON.parse(payload) as object;
  } catch {
    return undefined;
  }
};

/**
 * Reads the `responseId` a normalized chunk carries, if any.
 * @param chunk - one relayed `data: {...}` SSE frame
 */
export const readChunkResponseId = (chunk: string): string | undefined => {
  if (!chunk.startsWith('data: {') || !chunk.includes('"responseId"')) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(chunk.slice(6)) as {
      choices?: Array<{ delta?: { responseId?: string } }>;
    };
    return parsed.choices?.[0]?.delta?.responseId;
  } catch {
    return undefined;
  }
};

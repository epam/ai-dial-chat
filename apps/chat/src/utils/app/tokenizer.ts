import { Tiktoken, TiktokenEncoding, get_encoding } from 'tiktoken';

const encodingCache = new Map<string, Tiktoken>();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    encodingCache.forEach((encoding) => encoding.free());
    encodingCache.clear();
  });
}

export const getOrCreateEncoding = (encoding: TiktokenEncoding): Tiktoken => {
  if (!encodingCache.has(encoding)) {
    encodingCache.set(encoding, get_encoding(encoding));
  }
  return encodingCache.get(encoding)!;
};

export const getUtf8ByteLength = (str: string): number =>
  new TextEncoder().encode(str).byteLength;

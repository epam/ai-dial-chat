export const dataToBlobUrl = (dataUrl: string): string | null => {
  try {
    const separatorIndex = dataUrl.indexOf(',');

    if (separatorIndex < 0) {
      return null;
    }

    const metadata = dataUrl.slice(0, separatorIndex);
    const encodedPayload = dataUrl.slice(separatorIndex + 1);

    if (!encodedPayload) {
      return null;
    }

    const mime =
      metadata.match(/data:(.*?);base64/i)?.[1] ??
      metadata.match(/data:(.*?);/)?.[1] ??
      'application/octet-stream';

    const decodedPayload = atob(encodedPayload);
    let n = decodedPayload.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = decodedPayload.charCodeAt(n);
    }

    return URL.createObjectURL(new Blob([u8arr], { type: mime }));
  } catch {
    return null;
  }
};

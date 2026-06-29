export const getMimeFromDataUrl = (dataUrl: string): string | null =>
  dataUrl.match(/^data:(.*?);base64/i)?.[1] ??
  dataUrl.match(/^data:(.*?);/)?.[1] ??
  null;

export const dataToBlobUrl = (dataUrl: string): string | null => {
  try {
    const separatorIndex = dataUrl.indexOf(',');
    if (separatorIndex < 0) {
      return null;
    }

    const encodedPayload = dataUrl.slice(separatorIndex + 1);
    if (!encodedPayload) {
      return null;
    }

    const mime = getMimeFromDataUrl(dataUrl) ?? 'application/octet-stream';
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

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** Formats a byte count as a human-readable size string (e.g. `840 KB`, `2.4 MB`). */
export const formatFileSize = (bytes: number): string => {
  if (bytes >= GB)
    return `${(bytes / GB).toFixed(bytes % GB === 0 ? 0 : 1)} GB`;
  if (bytes >= MB)
    return `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)} MB`;
  if (bytes >= KB)
    return `${(bytes / KB).toFixed(bytes % KB === 0 ? 0 : 1)} KB`;
  return `${bytes} B`;
};

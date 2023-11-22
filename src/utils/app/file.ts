import { DialFile } from '@/src/types/files';

export function triggerDownload(url: string, name: string): void {
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const getPathNameId = (name: string, relativePath?: string): string => {
  return [relativePath, name].filter(Boolean).join('/');
};

export const getRelativePath = (
  absolutePath: string | undefined,
): string | undefined => {
  return absolutePath?.split('/').toSpliced(0, 3).join('/') || undefined;
};

export const getUserCustomContent = (files: DialFile[]) => {
  if (files.length === 0) {
    return undefined;
  }

  return {
    custom_content: {
      attachments: files
        .filter(
          (file) => file.status !== 'FAILED' && file.status !== 'UPLOADING',
        )
        .map((file) => ({
          type: file.contentType,
          title: file.name,
          url: encodeURI(`${file.absolutePath}/${file.name}`),
        })),
    },
  };
};

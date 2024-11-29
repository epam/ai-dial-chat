import { getDownloadPath } from '@/src/utils/app/file';
import { ApiUtils } from '@/src/utils/server/api';

import { DialFile } from '@/src/types/files';
import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

export default function DownloadRenderer({
  customTriggerData,
  onClick,
  className,
  Renderer,
  ...props
}: CustomTriggerMenuRendererProps) {
  const file = customTriggerData as DialFile;
  const filePath = getDownloadPath(file);
  return (
    <a
      download={file.name}
      href={`/api/${ApiUtils.encodeApiUrl(filePath)}`}
      onClick={onClick}
      className={className}
    >
      <Renderer {...props} />
    </a>
  );
}

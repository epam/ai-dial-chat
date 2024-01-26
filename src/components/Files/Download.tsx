import { constructPath } from '@/src/utils/app/file';
import { ApiKeys } from '@/src/utils/server/api';

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
  return (
    <a
      download={file.name}
      href={`api/${ApiKeys.Files}/file/${constructPath(
        file.absolutePath,
        file.name,
      )}`}
      onClick={onClick}
      className={className}
    >
      <Renderer {...props} />
    </a>
  );
}

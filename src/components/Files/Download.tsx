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
      href={`api/files?path=${[file.absolutePath, file.name].join('/')}`}
      onClick={onClick}
      className={className}
    >
      <Renderer {...props} />
    </a>
  );
}

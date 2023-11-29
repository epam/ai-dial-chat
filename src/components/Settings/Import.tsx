import { FC, useRef } from 'react';

import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

export const Import: FC<CustomTriggerMenuRendererProps> = ({
  Renderer,
  onClick: onImport,
  ...rendererProps
}) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".json"
        onChange={(e) => {
          if (!e.target.files?.length) return;

          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            const json = JSON.parse(readerEvent.target?.result as string);
            onImport?.(json);
            (ref.current as unknown as HTMLInputElement).value = '';
          };
          reader.readAsText(file);
        }}
      />
      <Renderer
        {...rendererProps}
        onClick={() => {
          const importFile = ref.current;
          if (importFile) {
            importFile.click();
          }
        }}
      />
    </>
  );
};

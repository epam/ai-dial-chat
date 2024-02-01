import { FC, MouseEvent, useRef } from 'react';

import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

export const Import: FC<CustomTriggerMenuRendererProps> = ({
  Renderer,
  onClick: onImport,
  ...rendererProps
}) => {
  const ref = useRef<HTMLInputElement>(null);

  const typedImportHandler = onImport as ({
    content,
    zip,
  }: {
    content: File;
    zip?: boolean;
  }) => void | undefined;

  const onClickHandler = (e: MouseEvent<HTMLInputElement>) => {
    e.currentTarget.value = '';
  };
  return (
    <>
      <input
        ref={ref}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="application/json, application/x-zip-compressed"
        onClick={onClickHandler}
        onChange={(e) => {
          if (!e.target.files?.length) return;
          const file = e.target.files[0];

          if (file.type === 'application/x-zip-compressed') {
            typedImportHandler?.({ content: file, zip: true });
            return;
          }

          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            const json = JSON.parse(readerEvent.target?.result as string);
            typedImportHandler?.({ content: json });
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

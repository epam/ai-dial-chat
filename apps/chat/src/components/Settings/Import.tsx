import { FC, useRef } from 'react';
import toast from 'react-hot-toast';

import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

import { errorsMessages } from '@/src/constants/errors';

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

  return (
    <>
      <input
        ref={ref}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="application/json, application/x-zip-compressed, application/zip"
        onChange={(e) => {
          if (!e.target.files?.length) return;
          const file = e.target.files[0];

          if (
            file.type === 'application/zip' ||
            file.type === 'application/x-zip-compressed'
          ) {
            typedImportHandler?.({ content: file, zip: true });
            (ref.current as unknown as HTMLInputElement).value = '';
            return;
          }

          if (file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              const json = JSON.parse(readerEvent.target?.result as string);
              typedImportHandler?.({ content: json });
              (ref.current as unknown as HTMLInputElement).value = '';
            };
            reader.readAsText(file);
            return;
          }

          toast.error(errorsMessages.unsupportedDataFormat);
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

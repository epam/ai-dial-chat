import { FC, useCallback, useRef } from 'react';

import { CustomTriggerMenuRendererProps } from '@/src/types/menu';

import { useAppDispatch } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';

export const Import: FC<CustomTriggerMenuRendererProps> = ({
  Renderer,
  onClick: onImport,
  ...rendererProps
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  //TODO move to the onImport
  const zipImportHandler = useCallback(
    (zipFile: File) => {
      dispatch(ImportExportActions.importZipConversations({ zipFile }));
    },
    [dispatch],
  );

  return (
    <>
      <input
        ref={ref}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="application/json, application/x-zip-compressed"
        onChange={(e) => {
          if (!e.target.files?.length) return;
          if (e.target.files[0].type === 'application/x-zip-compressed') {
            zipImportHandler(e.target.files[0]);
            return;
          }

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

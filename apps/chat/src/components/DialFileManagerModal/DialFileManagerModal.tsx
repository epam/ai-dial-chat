import {
  DialFileManager,
  DialFileNodeType,
  DialPopup,
  DialPrimaryButton,
  GridSelectionMode,
  PopupSize,
  type DialFile,
  type FileManagerGridRow,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC, useCallback, useMemo, useState } from 'react';
import { useDialFileManager } from '../../hooks/files/useDialFileManager';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (files: DialFile[]) => void;
  bucket: string;
  title: string;
  attachLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  errorMessage: string;
  retryLabel: string;
  hiddenFilesLabel: string;
  showHiddenFilesLabel: string;
  hideHiddenFilesLabel: string;
  getSelectionLabel: (count: number) => string;
}

const DialFileManagerModal: FC<Props> = ({
  isOpen,
  onClose,
  onAttach,
  bucket,
  title,
  attachLabel,
  emptyTitle,
  emptyDescription,
  errorMessage,
  retryLabel,
  hiddenFilesLabel,
  showHiddenFilesLabel,
  hideHiddenFilesLabel,
  getSelectionLabel,
}) => {
  const { items, isLoading, error, path, onPathChange, retry } =
    useDialFileManager({ bucket });
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const filesByPath = useMemo(() => {
    const result = new Map<string, DialFile>();
    const collect = (nodes: DialFile[]) => {
      nodes.forEach((item) => {
        if (item.nodeType === DialFileNodeType.ITEM) {
          result.set(item.path, item);
          if (item.id) result.set(item.id, item);
        }
        if (item.items) collect(item.items);
      });
    };
    collect(items);
    return result;
  }, [items]);

  const selectedFiles = useMemo(
    () =>
      Array.from(selectedPaths)
        .map((selectedPath) => filesByPath.get(selectedPath))
        .filter((file): file is DialFile => file != null),
    [filesByPath, selectedPaths],
  );

  const handleAttach = useCallback(() => {
    onAttach(selectedFiles);
  }, [onAttach, selectedFiles]);

  const gridOptions = useMemo(
    () => ({
      selectionMode: GridSelectionMode.MULTIPLE,
      additionalGridOptions: {
        domLayout: 'normal' as const,
        rowSelection: {
          mode: 'multiRow' as const,
          isRowSelectable: (node: { data?: FileManagerGridRow | null }) =>
            node.data?.nodeType === DialFileNodeType.ITEM,
        },
      },
    }),
    [],
  );

  const toolbarOptions = useMemo(
    () => ({
      showHiddenFilesToggle: true,
      hiddenFilesSwitcherLabel: hiddenFilesLabel,
      showHiddenFilesLabel,
      hideHiddenFilesLabel,
    }),
    [hiddenFilesLabel, showHiddenFilesLabel, hideHiddenFilesLabel],
  );

  return (
    <DialPopup
      open={isOpen}
      header={title}
      size={PopupSize.Lg}
      className="flex !h-[min(800px,100dvh)] w-full flex-col !bg-layer-2 [&>[aria-label='popup-description']]:flex [&>[aria-label='popup-description']]:min-h-0 [&>[aria-label='popup-description']]:flex-col"
      onClose={onClose}
      footer={
        <div className="flex justify-end px-6 py-4">
          <DialPrimaryButton
            label={attachLabel}
            disabled={selectedFiles.length === 0 || isLoading}
            onClick={handleAttach}
          />
        </div>
      }
    >
      {error != null ? (
        <div role="alert" className="flex flex-col items-center gap-4 p-6">
          <p>{errorMessage}</p>
          <DialPrimaryButton label={retryLabel} onClick={retry} />
        </div>
      ) : (
        <div className="flex min-h-0 w-full grow overflow-auto bg-layer-2">
          <DialFileManager
            className="min-h-0 w-full grow bg-layer-2"
            gridClassName="size-full"
            items={items}
            path={path}
            onPathChange={onPathChange}
            filesLoading={isLoading}
            selectedPaths={selectedPaths}
            onSelectedPathsChange={setSelectedPaths}
            navigationPanelOptions={{
              searchable: false,
            }}
            gridOptions={gridOptions}
            toolbarOptions={toolbarOptions}
            bulkActionsToolbarOptions={{ getSelectionLabel }}
            emptyStateTitle={emptyTitle}
            emptyStateDescription={emptyDescription}
            uploadEnabled={false}
          />
        </div>
      )}
    </DialPopup>
  );
};

export default memo(DialFileManagerModal);

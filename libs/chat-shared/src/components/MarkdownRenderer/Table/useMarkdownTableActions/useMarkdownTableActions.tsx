import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconLayoutSidebarRight,
} from '@tabler/icons-react';
import { type ReactNode, useMemo } from 'react';
import styles from '../MarkdownTable.module.scss';
import { type MarkdownTableActionLabels } from '../table-serialization';

/** A table action rendered as an icon button. */
export interface MarkdownTableHeaderAction {
  /** Stable accessible name and tooltip text. */
  label: string;
  /** Decorative icon content. */
  icon: ReactNode;
  /** Called when the action is activated. */
  onClick: () => void;
}

/** Params for {@link useMarkdownTableActions}. */
export interface UseMarkdownTableActionsParams {
  /** Localized labels for table actions. `undefined` yields no actions. */
  actionLabels: MarkdownTableActionLabels | undefined;
  /** Whether the table has just been copied (shows a checkmark on the copy button). */
  isCopied: boolean;
  /** Called when the copy action is activated. */
  onCopy: () => void;
  /** Called when the download-as-CSV action is activated. */
  onDownloadCsv: () => void;
  /** Called when the open-in-canvas action is activated. Omit to hide that action. */
  onOpenInCanvas?: () => void;
}

/** Builds the {@link MarkdownTableHeaderAction} list for a table's action bar from its localized labels. */
export const useMarkdownTableActions = ({
  actionLabels,
  isCopied,
  onCopy,
  onDownloadCsv,
  onOpenInCanvas,
}: UseMarkdownTableActionsParams): MarkdownTableHeaderAction[] => {
  const copyLabel = actionLabels?.copyLabel;
  const downloadCsvLabel = actionLabels?.downloadCsvLabel;
  const openInCanvasLabel = actionLabels?.openInCanvasLabel;

  return useMemo(() => {
    const actions: MarkdownTableHeaderAction[] = [];

    if (copyLabel != null) {
      const copyIcon = isCopied ? (
        <IconCheck
          className={styles.copiedIcon}
          size={DIAL_ICON_SIZE.SM}
          stroke={DIAL_KIT_ICON_STROKE}
        />
      ) : (
        <IconCopy size={DIAL_ICON_SIZE.SM} stroke={DIAL_KIT_ICON_STROKE} />
      );
      actions.push({ label: copyLabel, icon: copyIcon, onClick: onCopy });
    }

    if (downloadCsvLabel != null) {
      actions.push({
        label: downloadCsvLabel,
        icon: (
          <IconDownload
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: onDownloadCsv,
      });
    }

    if (openInCanvasLabel != null && onOpenInCanvas != null) {
      actions.push({
        label: openInCanvasLabel,
        icon: (
          <IconLayoutSidebarRight
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: onOpenInCanvas,
      });
    }

    return actions;
  }, [
    copyLabel,
    downloadCsvLabel,
    openInCanvasLabel,
    isCopied,
    onCopy,
    onDownloadCsv,
    onOpenInCanvas,
  ]);
};

import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconCsv,
  IconDownload,
  IconMaximize,
  IconMarkdown,
  IconTxt,
} from '@tabler/icons-react';
import { type ReactNode, useMemo } from 'react';
import styles from '../MarkdownTable.module.scss';
import {
  MarkdownTableCopyFormat,
  type MarkdownTableActionLabels,
} from '../table-serialization';

/** A table header action rendered as an icon button. */
export interface MarkdownTableHeaderAction {
  /** Stable accessible name and tooltip text. */
  label: string;
  /** Decorative icon content. */
  icon: ReactNode;
  /** Called when the action is activated. */
  onClick: () => void;
}

interface CopyActionConfig {
  label: string | undefined;
  format: MarkdownTableCopyFormat;
  Icon: typeof IconCsv;
}

/** Params for {@link useMarkdownTableActions}. */
export interface UseMarkdownTableActionsParams {
  /** Localized labels for table actions. `undefined` yields no actions. */
  actionLabels: MarkdownTableActionLabels | undefined;
  /** The copy format whose icon should render as a checkmark, or `undefined`. */
  copiedFormat: MarkdownTableCopyFormat | undefined;
  /** Called with the requested format when a copy action is activated. */
  onCopy: (format: MarkdownTableCopyFormat) => void;
  /** Called when the download-as-CSV action is activated. */
  onDownloadCsv: () => void;
  /** Called when the open-in-canvas action is activated. Omit to hide that action. */
  onOpenInCanvas?: () => void;
}

/** Builds the {@link MarkdownTableHeaderAction} list for a table's action bar from its localized labels. */
export const useMarkdownTableActions = ({
  actionLabels,
  copiedFormat,
  onCopy,
  onDownloadCsv,
  onOpenInCanvas,
}: UseMarkdownTableActionsParams): MarkdownTableHeaderAction[] =>
  useMemo(() => {
    if (actionLabels == null) return [];

    const actions: MarkdownTableHeaderAction[] = [];

    const copyConfigs: CopyActionConfig[] = [
      {
        label: actionLabels.copyCsvLabel,
        format: MarkdownTableCopyFormat.Csv,
        Icon: IconCsv,
      },
      {
        label: actionLabels.copyTxtLabel,
        format: MarkdownTableCopyFormat.Txt,
        Icon: IconTxt,
      },
      {
        label: actionLabels.copyMarkdownLabel,
        format: MarkdownTableCopyFormat.Markdown,
        Icon: IconMarkdown,
      },
    ];

    for (const { label, format, Icon } of copyConfigs) {
      if (label == null) continue;

      const icon =
        copiedFormat === format ? (
          <IconCheck
            className={styles.copiedIcon}
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ) : (
          <Icon size={DIAL_ICON_SIZE.SM} stroke={DIAL_KIT_ICON_STROKE} />
        );

      actions.push({ label, icon, onClick: () => onCopy(format) });
    }

    if (actionLabels.downloadCsvLabel != null) {
      actions.push({
        label: actionLabels.downloadCsvLabel,
        icon: (
          <IconDownload
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: onDownloadCsv,
      });
    }

    if (actionLabels.openInCanvasLabel != null && onOpenInCanvas != null) {
      actions.push({
        label: actionLabels.openInCanvasLabel,
        icon: (
          <IconMaximize
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: onOpenInCanvas,
      });
    }

    return actions;
  }, [actionLabels, copiedFormat, onCopy, onDownloadCsv, onOpenInCanvas]);

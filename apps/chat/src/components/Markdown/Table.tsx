import {
  IconCheck,
  IconCsv,
  IconMarkdown,
  IconTxt,
  TablerIconsProps,
} from '@tabler/icons-react';
import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { CopyTableType } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import Tooltip from '@/src/components/Common/Tooltip';

interface CopyIconProps {
  Icon: FC<TablerIconsProps>;
  onClick: () => void;
  copied: boolean;
  type: CopyTableType;
}

const CopyIcon = ({ Icon, onClick, copied, type }: CopyIconProps) => {
  const IconComponent = copied ? IconCheck : Icon;

  return (
    <IconComponent
      className="cursor-pointer text-secondary hover:text-accent-primary"
      size={24}
      data-qa={type.concat('-icon')}
      onClick={() => {
        if (!copied) {
          onClick();
        }
      }}
    />
  );
};

interface Props {
  children: ReactNode[];
  isLastMessageStreaming: boolean;
}

export const Table = ({ children, isLastMessageStreaming }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const tableRef = useRef<HTMLTableElement | null>(null);

  const [copiedType, setCopiedType] = useState<CopyTableType | undefined>(
    undefined,
  );
  const [timer, setTimer] = useState<NodeJS.Timeout | undefined>(undefined);

  const withCopyToClipboard = useCallback(
    (type: CopyTableType, fn: (table: HTMLTableElement) => string) => () => {
      if (tableRef.current) {
        const text = fn(tableRef.current);
        navigator.clipboard.writeText(text).then(() => {
          if (timer && type !== copiedType) {
            clearTimeout(timer);
          }

          setCopiedType(type);
          const newTimer = setTimeout(() => {
            setCopiedType(undefined);
            setTimer(undefined);
          }, 2000);

          setTimer(newTimer);
        });
      }
    },
    [copiedType, tableRef, timer],
  );

  useEffect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [timer]);

  const copyTableToMD = useCallback(
    () =>
      withCopyToClipboard(CopyTableType.MD, (table) => {
        const getAlignment = (alignment: string) => {
          if (alignment === 'left') return ':--';
          if (alignment === 'right') return '--:';

          return ':-:';
        };

        const markdown = Array.from(table.rows).reduce((acc: string[], row) => {
          const rowArray = Array.from(row.cells).map((cell) =>
            cell.textContent ? cell.textContent.trim() : '',
          );
          acc.push('| ' + rowArray.join(' | ') + ' |');

          if (row.rowIndex === 0) {
            const alignmentArray = Array.from(row.cells).map((cell) => {
              return getAlignment(cell.style.textAlign || 'left');
            });
            acc.push('| ' + alignmentArray.join(' | ') + ' |');
          }

          return acc;
        }, []);

        return markdown.join('\n');
      })(),
    [withCopyToClipboard],
  );

  const copyTableToTXT = useCallback(
    () =>
      withCopyToClipboard(CopyTableType.TXT, (table) => {
        const txt = Array.from(table.rows).map((row) => {
          const rowArray = Array.from(row.cells).map((cell) =>
            cell.textContent ? cell.textContent.trim() : '',
          );

          return rowArray.join('\t');
        });

        return txt.join('\n');
      })(),
    [withCopyToClipboard],
  );

  const copyTableToCSV = useCallback(
    () =>
      withCopyToClipboard(CopyTableType.CSV, (table) => {
        const csv = Array.from(table.rows).map((row) => {
          const rowArray = Array.from(row.cells).map((cell) =>
            cell.textContent?.trim()
              ? `"${cell.textContent.trim().replace(/"/g, '""')}"`
              : '',
          );

          return rowArray.join(',');
        });

        return csv.join('\n');
      })(),
    [withCopyToClipboard],
  );

  return (
    <div className="mt-7 max-w-full overflow-auto" data-qa="table">
      {!isLastMessageStreaming && (
        <div
          className="flex max-w-full justify-end bg-layer-3 px-2 py-1"
          data-qa="table-controls"
        >
          <div data-no-context-menu className="flex gap-2">
            <Tooltip placement="top" tooltip={t('Copy as CSV')}>
              <CopyIcon
                Icon={IconCsv}
                onClick={copyTableToCSV}
                copied={CopyTableType.CSV === copiedType}
                type={CopyTableType.CSV}
              />
            </Tooltip>
            <Tooltip placement="top" tooltip={t('Copy as TXT')}>
              <CopyIcon
                Icon={IconTxt}
                onClick={copyTableToTXT}
                copied={CopyTableType.TXT === copiedType}
                type={CopyTableType.TXT}
              />
            </Tooltip>
            <Tooltip placement="top" tooltip={t('Copy as MD')}>
              <CopyIcon
                Icon={IconMarkdown}
                onClick={copyTableToMD}
                copied={CopyTableType.MD === copiedType}
                type={CopyTableType.MD}
              />
            </Tooltip>
          </div>
        </div>
      )}
      <table
        ref={tableRef}
        className="mt-0 border-collapse border border-tertiary px-3 py-1 text-sm"
      >
        {children}
      </table>
    </div>
  );
};

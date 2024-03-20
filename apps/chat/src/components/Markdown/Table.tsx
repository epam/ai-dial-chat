import {
  IconCheck,
  IconCsv,
  IconMarkdown,
  IconTxt,
  TablerIconsProps,
} from '@tabler/icons-react';
import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { CopyTableType } from '@/src/types/chat';

interface CopyIconProps {
  Icon: FC<TablerIconsProps>;
  onClick: () => void;
  copied: boolean;
}

const CopyIcon = ({ Icon, onClick, copied }: CopyIconProps) => {
  const IconComponent = copied ? IconCheck : Icon;

  return (
    <IconComponent
      className="cursor-pointer text-secondary hover:text-accent-primary"
      size={24}
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
}

export const Table = ({ children }: Props) => {
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
            cell.textContent ? cell.textContent.trim() : '',
          );

          return rowArray.join(',');
        });

        return csv.join('\n');
      })(),
    [withCopyToClipboard],
  );

  return (
    <div className="mt-7 max-w-full overflow-auto">
      <div className="flex max-w-full justify-end gap-2 bg-layer-3 px-2 py-1">
        <CopyIcon
          Icon={IconCsv}
          onClick={copyTableToCSV}
          copied={CopyTableType.CSV === copiedType}
        />
        <CopyIcon
          Icon={IconTxt}
          onClick={copyTableToTXT}
          copied={CopyTableType.TXT === copiedType}
        />
        <CopyIcon
          Icon={IconMarkdown}
          onClick={copyTableToMD}
          copied={CopyTableType.MD === copiedType}
        />
      </div>
      <table
        ref={tableRef}
        className="mt-0 border-collapse border border-tertiary px-3 py-1 text-sm"
      >
        {children}
      </table>
    </div>
  );
};

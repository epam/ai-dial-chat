import {
  Icon,
  IconCheck,
  IconCsv,
  IconMarkdown,
  IconTxt,
} from '@tabler/icons-react';
import {
  Children,
  ReactElement,
  ReactNode,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { writeTextToClipboard } from '@/src/utils/app/clipboard';

import { CopyTableType } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { MarkdownI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface CopyIconProps {
  Icon: Icon;
  onClick: () => void;
  copied: boolean;
  type: CopyTableType;
}

const CopyIcon = ({ Icon, onClick, copied, type }: CopyIconProps) => {
  const IconComponent = copied ? IconCheck : Icon;

  return (
    <IconComponent
      stroke={1.5}
      className="cursor-pointer text-secondary hover:text-accent-primary"
      size={DEFAULT_ICON_SIZES.STANDARD}
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
  children: ReactNode[] | ReactNode;
  isLastMessageStreaming: boolean;
}

const isThead = (node: ReactNode) =>
  isValidElement(node) && (node as ReactElement).type === 'thead';

export const Table = ({ children, isLastMessageStreaming }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const headerTableRef = useRef<HTMLTableElement | null>(null);
  const bodyTableRef = useRef<HTMLTableElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);

  const [copiedType, setCopiedType] = useState<CopyTableType | undefined>(
    undefined,
  );
  const [timer, setTimer] = useState<NodeJS.Timeout | undefined>(undefined);

  const childArray = Children.toArray(children);
  const head = childArray.find(isThead);
  const body = childArray.filter((child) => !isThead(child));

  const syncHeaderScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }, []);

  const syncColumnWidths = useCallback(() => {
    const headerRow = headerTableRef.current?.rows[0];
    const bodyRow = bodyTableRef.current?.rows[0];

    if (!headerRow || !bodyRow) {
      return;
    }

    const headerCells = Array.from(headerRow.cells);
    const bodyCells = Array.from(bodyRow.cells);

    [headerTableRef.current, bodyTableRef.current].forEach((table) => {
      if (table) {
        table.style.width = 'max-content';
      }
    });
    [...headerCells, ...bodyCells].forEach((cell) => {
      cell.style.width = '';
      cell.style.minWidth = '';
      cell.style.maxWidth = '';
    });

    const widths = headerCells.map((headerCell, index) => {
      const bodyCell = bodyCells[index];

      return Math.ceil(
        Math.max(
          headerCell.getBoundingClientRect().width,
          bodyCell ? bodyCell.getBoundingClientRect().width : 0,
        ),
      );
    });

    [headerTableRef.current, bodyTableRef.current].forEach((table) => {
      if (table) {
        table.style.width = '';
      }
    });
    widths.forEach((width, index) => {
      const value = `${width}px`;
      [headerCells[index], bodyCells[index]].forEach((cell) => {
        if (cell) {
          cell.style.width = value;
          cell.style.minWidth = value;
          cell.style.maxWidth = value;
        }
      });
    });
  }, []);

  useLayoutEffect(() => {
    syncColumnWidths();

    const bodyTable = bodyTableRef.current;

    if (!bodyTable || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => syncColumnWidths());
    observer.observe(bodyTable);
    window.addEventListener('resize', syncColumnWidths);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncColumnWidths);
    };
  }, [syncColumnWidths, children]);

  const withCopyToClipboard = useCallback(
    (type: CopyTableType, fn: (rows: HTMLTableRowElement[]) => string) =>
      () => {
        if (bodyTableRef.current) {
          const rows = [
            ...(headerTableRef.current
              ? Array.from(headerTableRef.current.rows)
              : []),
            ...Array.from(bodyTableRef.current.rows),
          ];
          const text = fn(rows);
          writeTextToClipboard(text, () => {
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
    [copiedType, timer],
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
      withCopyToClipboard(CopyTableType.MD, (rows) => {
        const getAlignment = (alignment: string) => {
          if (alignment === 'left') return ':--';
          if (alignment === 'right') return '--:';

          return ':-:';
        };

        const markdown = rows.reduce((acc: string[], row, rowIndex) => {
          const rowArray = Array.from(row.cells).map((cell) =>
            cell.textContent ? cell.textContent.trim() : '',
          );
          acc.push('| ' + rowArray.join(' | ') + ' |');

          if (rowIndex === 0) {
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
      withCopyToClipboard(CopyTableType.TXT, (rows) => {
        const txt = rows.map((row) => {
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
      withCopyToClipboard(CopyTableType.CSV, (rows) => {
        const csv = rows.map((row) => {
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
    <div className="mt-7 max-w-full" data-qa="table">
      {!isLastMessageStreaming && (
        <div
          className="flex max-w-full justify-end rounded-t border border-b-0 border-tertiary bg-layer-3 px-2 py-1"
          data-qa="table-controls"
        >
          <div data-no-context-menu className="flex gap-2">
            <Tooltip
              placement="top"
              tooltip={t(MarkdownI18nKeys.CopyAsCSV, {
                ns: Translation.Markdown,
              })}
            >
              <CopyIcon
                Icon={IconCsv}
                onClick={copyTableToCSV}
                copied={CopyTableType.CSV === copiedType}
                type={CopyTableType.CSV}
              />
            </Tooltip>
            <Tooltip
              placement="top"
              tooltip={t(MarkdownI18nKeys.CopyAsTXT, {
                ns: Translation.Markdown,
              })}
            >
              <CopyIcon
                Icon={IconTxt}
                onClick={copyTableToTXT}
                copied={CopyTableType.TXT === copiedType}
                type={CopyTableType.TXT}
              />
            </Tooltip>
            <Tooltip
              placement="top"
              tooltip={t(MarkdownI18nKeys.CopyAsMD, {
                ns: Translation.Markdown,
              })}
            >
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
      {head && (
        <div
          ref={headerScrollRef}
          className="overflow-hidden border-l border-t border-tertiary"
        >
          <table
            ref={headerTableRef}
            className="my-0 w-full border-separate border-spacing-0 text-sm"
            aria-hidden
          >
            {head}
          </table>
        </div>
      )}
      <div
        ref={bodyScrollRef}
        onScroll={syncHeaderScroll}
        className="max-h-[68vh] overflow-auto border-l border-tertiary"
      >
        <table
          ref={bodyTableRef}
          className="my-0 w-full border-separate border-spacing-0 text-sm"
        >
          {body}
        </table>
      </div>
    </div>
  );
};

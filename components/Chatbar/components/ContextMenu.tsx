import {
  IconFileExport,
  IconPencil,
  IconRefreshDot,
  IconTrash,
} from '@tabler/icons-react';
import { MouseEventHandler, RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  parentRef: RefObject<HTMLDivElement>;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport: MouseEventHandler<unknown>;
  onReplay: MouseEventHandler<HTMLLIElement>;
}

export const ContextMenu = ({
  parentRef,
  onDelete,
  onRename,
  onExport,
  onReplay,
}: Props) => {
  const { t } = useTranslation('sidebar');
  const contextMenuHeight = 120;
  let classes = useRef('');

  classes.current = getContextMenuPositioningClasses(
    parentRef,
    contextMenuHeight,
  );

  return (
    <div
      className={`absolute right-0 min-w-[50px] z-20 bg-[#202123] p-2 rounded-lg border border-neutral-600 ${classes.current}`}
    >
      <ul className="flex flex-col gap-2">
        <li
          onClick={onRename}
          className="flex cursor-pointer p-2 hover:bg-[#343541] rounded-lg"
        >
          <IconPencil size={18} />
          <span className="ml-2">{t('Rename')}</span>
        </li>
        <li
          onClick={onReplay}
          className="flex cursor-pointer p-2 hover:bg-[#343541] rounded-lg"
        >
          <IconRefreshDot size={18} />
          <span className="ml-2">{t('Replay')}</span>
        </li>
        <li
          onClick={onExport}
          className="flex cursor-pointer p-2 hover:bg-[#343541] rounded-lg"
        >
          <IconFileExport size={18} />
          <span className="ml-2">{t('Export')}</span>
        </li>
        <li
          onClick={onDelete}
          className="flex cursor-pointer p-2 hover:bg-[#343541] rounded-lg"
        >
          <IconTrash size={18} />
          <span className="ml-2">{t('Delete')}</span>
        </li>
      </ul>
    </div>
  );
};

function getContextMenuPositioningClasses(
  parentRef: RefObject<HTMLDivElement>,
  contextMenuHeight: number,
): string {
  const padding = 20;
  const classesTop = `top-5 bottom-auto`;
  const classesBottom = `bottom-5 top-auto`;
  let parent = parentRef.current as HTMLDivElement | null;

  while (parent) {
    const parentStyle = window.getComputedStyle(parent);

    if (parentStyle.overflowY === 'auto') {
      const directParentRefRect = (
        parentRef.current as HTMLDivElement
      ).getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();

      if (
        parentRect.bottom - contextMenuHeight - padding >=
        directParentRefRect.top
      ) {
        return classesTop;
      }
      return classesBottom;
    }
    parent = parent.parentNode as HTMLDivElement | null;
  }

  return classesTop;
}

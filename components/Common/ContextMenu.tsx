import {
  IconFileExport,
  IconPencil,
  IconRefreshDot,
  IconScale,
  IconTrash,
} from '@tabler/icons-react';
import { MouseEventHandler, RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { FeatureType } from '@/types/components';

interface Props {
  parentRef: RefObject<HTMLDivElement>;
  featureType: FeatureType;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport: MouseEventHandler<unknown>;
  onReplay?: MouseEventHandler<HTMLLIElement>;
  onCompare?: MouseEventHandler<unknown>;
  isEmptyConversation?: boolean;
}

export const ContextMenu = ({
  parentRef,
  onDelete,
  onRename,
  onExport,
  onReplay,
  onCompare,
  isEmptyConversation,
  featureType,
}: Props) => {
  const { t } = useTranslation('sidebar');
  const contextMenuHeight = 230;
  const classes = useRef('');

  const isConversation = featureType === 'conversation';

  classes.current = getContextMenuPositioningClasses(
    parentRef,
    contextMenuHeight,
  );

  return (
    <div
      className={`absolute right-0 z-20 min-w-[50px] rounded-lg border border-neutral-600 bg-[#202123] p-2 ${classes.current}`}
    >
      <ul className="flex flex-col gap-2">
        <li
          onClick={onRename}
          className="flex cursor-pointer rounded-lg p-2 hover:bg-[#343541]"
        >
          <IconPencil size={18} />
          <span className="ml-2">
            {t(`${isConversation ? 'Rename' : 'Edit'}`)}
          </span>
        </li>
        {onCompare && (
          <li
            onClick={onCompare}
            className="flex cursor-pointer rounded-lg p-2 hover:bg-[#343541]"
          >
            <IconScale size={18} />
            <span className="ml-2">{t('Compare')}</span>
          </li>
        )}
        {!isEmptyConversation && onReplay && (
          <li
            onClick={onReplay}
            className="flex cursor-pointer rounded-lg p-2 hover:bg-[#343541]"
          >
            <IconRefreshDot size={18} />
            <span className="ml-2">{t('Replay')}</span>
          </li>
        )}
        <li
          onClick={onExport}
          className="flex cursor-pointer rounded-lg p-2 hover:bg-[#343541]"
        >
          <IconFileExport size={18} />
          <span className="ml-2">{t('Export')}</span>
        </li>
        <li
          onClick={onDelete}
          className="flex cursor-pointer rounded-lg p-2 hover:bg-[#343541]"
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

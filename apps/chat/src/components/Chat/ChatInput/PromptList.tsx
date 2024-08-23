import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { FC, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  addVersionToId,
  getPublicItemIdWithoutVersion,
} from '@/src/utils/server/api';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { stopBubbling } from '@/src/constants/chat';
import { NA_VERSION } from '@/src/constants/public';

import { Menu, MenuItem } from '../../Common/DropdownMenu';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';

interface ListItemProps {
  prompt: Prompt;
  index: number;
  activePromptIndex: number;
  onSelect: (id?: string) => void;
  onMouseEnter: (index: number) => void;
}

const PromptListItem: FC<ListItemProps> = ({
  prompt,
  index,
  activePromptIndex,
  onSelect,
  onMouseEnter,
}: ListItemProps) => {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);

  const publicVersionGroups = useAppSelector(
    PromptsSelectors.selectPublicVersionGroups,
  );

  const currentVersionGroup = useMemo(() => {
    if (!prompt.publicationInfo?.version) {
      return null;
    }

    const currentVersionGroup =
      publicVersionGroups[
        getPublicItemIdWithoutVersion(prompt.publicationInfo.version, prompt.id)
      ];

    return currentVersionGroup;
  }, [prompt.id, prompt.publicationInfo?.version, publicVersionGroups]);

  return (
    <li
      className={classNames(
        'flex cursor-pointer justify-between truncate px-3 py-2',
        index === activePromptIndex && 'bg-accent-primary-alpha',
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      data-qa="prompt-option"
      onMouseEnter={() => onMouseEnter(index)}
    >
      <p>{prompt.name}</p>
      {currentVersionGroup?.allVersions && (
        <Menu
          type="contextMenu"
          placement="bottom-end"
          onOpenChange={setIsVersionMenuOpen}
          data-qa="model-version-select"
          trigger={
            <button
              disabled={currentVersionGroup.allVersions.length <= 1}
              className="flex items-center justify-between gap-2"
              data-qa="model-version-select-trigger"
              data-model-versions
              onClick={stopBubbling}
            >
              <span>
                {prompt.publicationInfo?.version
                  ? ` ${t('v.')} ${prompt.publicationInfo?.version}`
                  : ''}
              </span>
              {currentVersionGroup.allVersions.length > 1 && (
                <ChevronDownIcon
                  className={classNames(
                    'shrink-0 text-primary transition-all',
                    isVersionMenuOpen && 'rotate-180',
                  )}
                  width={18}
                  height={18}
                />
              )}
            </button>
          }
        >
          {currentVersionGroup.allVersions.map(({ version }) => {
            if (currentVersionGroup.selectedVersion.version === version) {
              return null;
            }

            return (
              <MenuItem
                onClick={(e) => {
                  stopBubbling(e);

                  const itemIdWithoutVersion = getPublicItemIdWithoutVersion(
                    currentVersionGroup.selectedVersion.version,
                    prompt.id,
                  );

                  if (version === NA_VERSION) {
                    onSelect(itemIdWithoutVersion);
                  } else {
                    onSelect(addVersionToId(itemIdWithoutVersion, version));
                  }
                }}
                className="hover:bg-accent-primary-alpha"
                item={<span>{version}</span>}
                key={version}
              />
            );
          })}
        </Menu>
      )}
    </li>
  );
};

interface Props {
  prompts: Prompt[];
  activePromptIndex: number;
  onSelect: (id?: string) => void;
  onMouseEnter: (index: number) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const PromptList: FC<Props> = ({
  prompts,
  activePromptIndex,
  onSelect,
  onMouseEnter,
  onClose,
  isOpen,
}) => {
  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: () => {
      onClose();
    },
  });

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    if (refs.floating.current) {
      refs.floating.current.scrollTop = activePromptIndex * 30;
    }
  }, [activePromptIndex, refs.floating]);

  return (
    <ul
      ref={refs.setFloating}
      {...getFloatingProps()}
      className="z-10 max-h-52 w-full overflow-auto rounded bg-layer-3"
      data-qa="prompt-list"
    >
      {prompts.map((prompt, index) => (
        <PromptListItem
          prompt={prompt}
          index={index}
          key={prompt.id}
          activePromptIndex={activePromptIndex}
          onSelect={onSelect}
          onMouseEnter={onMouseEnter}
        />
      ))}
    </ul>
  );
};

import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { FC, useEffect, useRef } from 'react';

import classNames from 'classnames';

import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { Prompt } from '@/src/types/prompt';

import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';

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
      <p className="truncate">{prompt.name}</p>
      {prompt.publicationInfo?.version && (
        <PublicVersionSelector
          publicVersionGroupId={getPublicItemIdWithoutVersion(
            prompt.publicationInfo.version,
            prompt.id,
          )}
          onChangeSelectedVersion={onSelect}
        />
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

  const isMouseInteraction = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'Tab'].includes(e.key)) {
        isMouseInteraction.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (
      activePromptIndex !== -1 &&
      refs.floating.current &&
      !isMouseInteraction.current
    ) {
      const activeItem = refs.floating.current.children[
        activePromptIndex
      ] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
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
          onMouseEnter={(idx) => {
            isMouseInteraction.current = true;
            onMouseEnter(idx);
          }}
        />
      ))}
    </ul>
  );
};

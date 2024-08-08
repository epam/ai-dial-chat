import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { FC, useEffect, useMemo } from 'react';

import classNames from 'classnames';

import { FeatureType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

interface Props {
  prompts: Prompt[];
  activePromptIndex: number;
  onSelect: () => void;
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
  const promptResources = useAppSelector((state) =>
    PublicationSelectors.selectFilteredPublicationResources(
      state,
      FeatureType.Prompt,
    ),
  );

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    if (refs.floating.current) {
      refs.floating.current.scrollTop = activePromptIndex * 30;
    }
  }, [activePromptIndex, refs.floating]);

  const filteredPrompts = useMemo(() => {
    const publicationPromptUrls = promptResources.map((r) => r.reviewUrl);
    return prompts.filter((p) => !publicationPromptUrls.includes(p.id));
  }, [promptResources, prompts]);

  return (
    <ul
      ref={refs.setFloating}
      {...getFloatingProps()}
      className="z-10 max-h-52 w-full overflow-auto rounded-primary border border-secondary bg-layer-2 shadow-primary"
      data-qa="prompt-list"
    >
      {filteredPrompts.map((prompt, index) => (
        <li
          key={prompt.id}
          className={classNames(
            'cursor-pointer truncate px-3 py-2',
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
          {prompt.name}
        </li>
      ))}
    </ul>
  );
};

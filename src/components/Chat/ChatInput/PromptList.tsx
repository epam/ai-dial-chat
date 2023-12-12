import { useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { FC, useEffect } from 'react';

import { Prompt } from '@/src/types/prompt';

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
      className="bg-gray-100 z-10 max-h-52 w-full overflow-auto rounded"
      data-qa="prompt-list"
    >
      {prompts.map((prompt, index) => (
        <li
          key={prompt.id}
          className={`${
            index === activePromptIndex ? 'bg-blue-500/20' : ''
          } cursor-pointer px-3 py-2`}
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

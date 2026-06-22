import { IconBulb } from '@tabler/icons-react';
import { forwardRef } from 'react';

import classNames from 'classnames';

import { Prompt } from '@/src/types/prompt';

import { Checkbox } from './Checkbox';

interface PromptRowProps {
  item: Prompt;
  level: number;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export const PromptRow = forwardRef<HTMLDivElement, PromptRowProps>(
  ({ item: prompt, level = 0, isSelected, onToggle }, ref) => {
    return (
      <div
        ref={ref}
        className={classNames(
          'group relative flex h-[32px] w-full shrink-0 cursor-pointer select-none items-center rounded border-l-2 border-l-transparent pr-3 hover:bg-accent-primary-alpha',
          isSelected && 'bg-accent-primary-alpha',
        )}
        style={{ paddingLeft: `${level * 24 + 16}px` }}
        onClick={() => onToggle(prompt.id)}
        data-qa="prompt-row"
      >
        <div className="flex size-full items-center gap-2">
          <div className="relative flex size-[18px] shrink-0 items-center justify-center">
            <IconBulb
              size={18}
              strokeWidth={1.5}
              className={classNames(
                'shrink-0 text-secondary',
                isSelected ? 'opacity-0' : 'group-hover:opacity-0',
              )}
            />
            <div
              className={classNames(
                'absolute inset-0 flex items-center justify-center',
                !isSelected && 'opacity-0 group-hover:opacity-100',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => onToggle(prompt.id)}
                className="mr-0"
              />
            </div>
          </div>
          <span className="relative truncate text-start text-sm text-primary">
            {prompt.name}
          </span>
        </div>
      </div>
    );
  },
);

PromptRow.displayName = 'PromptRow';

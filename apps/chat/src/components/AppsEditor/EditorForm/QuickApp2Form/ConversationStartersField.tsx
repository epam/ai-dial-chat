import { IconTrash } from '@tabler/icons-react';
import { FC } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ConversationStarter } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { DialButton } from '@epam/ai-dial-ui-kit';

const EMPTY_STARTER: ConversationStarter = { title: '', text: '' };
const INPUT_CLASS =
  'input-form input-invalid peer mx-0 min-w-0 text-sm disabled:cursor-not-allowed disabled:border-primary';

interface ConversationStartersListProps {
  value: ConversationStarter[];
  onChange: (value: ConversationStarter[]) => void;
  disabled?: boolean;
}

export const ConversationStartersList: FC<ConversationStartersListProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const handleChange = (
    index: number,
    field: keyof ConversationStarter,
    val: string,
  ) => {
    const updated = value.map((s, i) =>
      i === index ? { ...s, [field]: val } : s,
    );
    const isLastRow = index === value.length - 1;
    const updatedItem = updated[index];

    if (isLastRow && (updatedItem.title || updatedItem.text)) {
      onChange([...updated, EMPTY_STARTER]);
    } else {
      onChange(updated);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value.map((item, index) => {
        const isLastRow = index === value.length - 1;

        return (
          <div key={index} className="flex items-center gap-2">
            <input
              value={item.title}
              onChange={(e) => handleChange(index, 'title', e.target.value)}
              className={classNames(INPUT_CLASS, 'flex-1')}
              placeholder={t('Button title (e.g., Travel tips)')}
              disabled={disabled}
            />
            <input
              value={item.text}
              onChange={(e) => handleChange(index, 'text', e.target.value)}
              className={classNames(INPUT_CLASS, 'flex-[2]')}
              placeholder={t(
                'Prompt to send in chat (e.g., Can you suggest some travel destinations?)',
              )}
              disabled={disabled}
            />
            <DialButton
              iconBefore={
                <IconTrash
                  size={16}
                  className={classNames(
                    isLastRow ? 'opacity-0' : 'text-secondary',
                  )}
                />
              }
              onClick={() =>
                !isLastRow && onChange(value.filter((_, i) => i !== index))
              }
              className={classNames(
                'shrink-0',
                isLastRow ? 'pointer-events-none' : 'hover:text-error',
              )}
              disabled={disabled || isLastRow}
            />
          </div>
        );
      })}
    </div>
  );
};

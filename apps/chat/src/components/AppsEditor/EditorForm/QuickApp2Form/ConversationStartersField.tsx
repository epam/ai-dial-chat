import { IconTrash } from '@tabler/icons-react';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import classNames from 'classnames';

import { ConversationStarter } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { DialButton } from '@epam/ai-dial-ui-kit';
import { nanoid } from 'nanoid';

const createEmptyStarter = () => ({ id: nanoid(), title: '', text: '' });
const INPUT_CLASS =
  'input-form input-invalid peer mx-0 min-w-0 text-sm disabled:cursor-not-allowed disabled:border-primary';

interface StarterWithId extends ConversationStarter {
  id: string;
}

interface ConversationStartersListProps {
  value: StarterWithId[];
  onChange: (value: StarterWithId[]) => void;
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
      onChange([...updated, createEmptyStarter()]);
    } else {
      onChange(updated);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value.map((item, index) => {
        const isLastRow = index === value.length - 1;

        return (
          <div key={item.id} className="flex items-center gap-2">
            <input
              value={item.title}
              onChange={(e) => handleChange(index, 'title', e.target.value)}
              className={classNames(INPUT_CLASS, 'flex-1')}
              placeholder={t(MarketplaceI18nKeys.ButtonTitleTravelTips) ?? ''}
              disabled={disabled}
            />
            <input
              value={item.text}
              onChange={(e) => handleChange(index, 'text', e.target.value)}
              className={classNames(INPUT_CLASS, 'flex-[2]')}
              placeholder={t(MarketplaceI18nKeys.PromptToSendInChat) ?? ''}
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

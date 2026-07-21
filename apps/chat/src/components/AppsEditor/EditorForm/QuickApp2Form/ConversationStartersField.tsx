import { IconTrashX } from '@tabler/icons-react';
import { FC, FocusEvent } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { ConversationStarter } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { DialGhostIconButton, DialInput } from '@epam/ai-dial-ui-kit';
import { nanoid } from 'nanoid';

const createEmptyStarter = () => ({ id: nanoid(), title: '', text: '' });

interface StarterWithId extends ConversationStarter {
  id: string;
}

interface ConversationStartersListProps {
  value: StarterWithId[];
  onChange: (value: StarterWithId[]) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export const ConversationStartersList: FC<ConversationStartersListProps> = ({
  value,
  onChange,
  onBlur,
  disabled,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const handleChange = (
    index: number,
    field: keyof ConversationStarter,
    val: string,
  ) => {
    const updated = value.map((s, i) =>
      i === index ? { ...s, [field]: val.length === 1 ? val.trim() : val } : s,
    );
    const isLastRow = index === value.length - 1;
    const updatedItem = updated[index];

    if (isLastRow && (updatedItem.title.trim() || updatedItem.text.trim())) {
      onChange([...updated, createEmptyStarter()]);
    } else {
      onChange(updated);
    }
  };

  const handleContainerBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!onBlur) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      onBlur();
    }
  };

  return (
    <div
      className="flex flex-col gap-2"
      onBlur={handleContainerBlur}
      data-qa="conversation-starters-list"
    >
      {value.map((item, index) => {
        const isLastRow = index === value.length - 1;

        return (
          <div key={item.id} className="flex items-center gap-2">
            <DialInput
              value={item.title}
              onChange={(value) => handleChange(index, 'title', value ?? '')}
              containerClassName="flex-1"
              placeholder={t(MarketplaceI18nKeys.ButtonTitleTravelTips) ?? ''}
              disabled={disabled}
            />
            <DialInput
              value={item.text}
              onChange={(value) => handleChange(index, 'text', value ?? '')}
              containerClassName="flex-[2]"
              placeholder={t(MarketplaceI18nKeys.PromptToSendInChat) ?? ''}
              disabled={disabled}
            />
            <DialGhostIconButton
              icon={
                <IconTrashX
                  strokeWidth={1.5}
                  size={24}
                  className={classNames(isLastRow && 'opacity-0')}
                />
              }
              onClick={() => {
                if (isLastRow) return;
                onChange(value.filter((_, i) => i !== index));
                onBlur?.();
              }}
              className={classNames(
                'shrink-0 px-2',
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

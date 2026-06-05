import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
  DialInput,
  DialNeutralButton,
  DialPopup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionsI18nKeys,
  ConversationHistoryI18nKeys,
} from '../../constants/translation-keys.js';

interface Props {
  open: boolean;
  currentTitle: string;
  isSaving: boolean;
  error: string | null;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
}

const RenameConversationPopup: FC<Props> = ({
  open,
  currentTitle,
  isSaving,
  error,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentTitle);
      // Defer focus so the popup has time to mount and become visible
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, currentTitle]);

  const trimmed = value.trim();
  const isSaveDisabled =
    isSaving || trimmed === '' || trimmed === currentTitle.trim();

  const handleSave = useCallback(() => {
    if (!isSaveDisabled) onSave(trimmed);
  }, [isSaveDisabled, onSave, trimmed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSave();
    },
    [handleSave],
  );

  return (
    <DialPopup
      open={open}
      header={t(ConversationHistoryI18nKeys.RenameTitle)}
      size={PopupSize.Sm}
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-2 p-4">
          <DialNeutralButton
            label={t(ActionsI18nKeys.Cancel)}
            onClick={onCancel}
            disabled={isSaving}
          />
          <DialButton
            label={t(ActionsI18nKeys.Save)}
            appearance={ButtonAppearance.Solid}
            variant={ButtonVariant.Primary}
            onClick={handleSave}
            disabled={isSaveDisabled}
          />
        </div>
      }
    >
      <div className="py-4 pl-6 pr-4">
        <DialInput
          inputRef={inputRef}
          value={value}
          placeholder={t(ConversationHistoryI18nKeys.RenameInputPlaceholder)}
          onChange={(v) => setValue(v ?? '')}
          onKeyDown={handleKeyDown}
        />
        {error && (
          <p role="alert" className="mt-1 text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </DialPopup>
  );
};

export default memo(RenameConversationPopup);

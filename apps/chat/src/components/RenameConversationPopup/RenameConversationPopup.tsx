import {
  DIAL_ICON_SIZE,
  DialFormPopup,
  DialGhostIconButton,
  DialInput,
  DialSpinner,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { IconSparkles } from '@tabler/icons-react';
import {
  KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import {
  getUtf8ByteLength,
  sanitizeConversationName,
  stripTrailingDots,
} from '../../utils/string-utils';

interface Props {
  isOpen: boolean;
  currentTitle: string;
  isSaving: boolean;
  error: string | null;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
  onGenerateWithAi: () => Promise<string>;
}

const RenameConversationPopup: FC<Props> = ({
  isOpen,
  currentTitle,
  isSaving,
  error,
  onSave,
  onCancel,
  onGenerateWithAi,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentTitle);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(currentTitle);
      setGenerateError(null);
      // Defer focus so the popup has time to mount and become visible
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, currentTitle]);

  const trimmed = stripTrailingDots(value.trim());
  const isTooLong = getUtf8ByteLength(trimmed) > 255;
  const isSaveDisabled =
    isSaving || trimmed === '' || trimmed === currentTitle.trim() || isTooLong;

  const handleSave = useCallback(() => {
    if (!isSaveDisabled) onSave(trimmed);
  }, [isSaveDisabled, onSave, trimmed]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSave();
    },
    [handleSave],
  );

  const handleGenerateWithAi = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const generatedName = await onGenerateWithAi();
      setValue(sanitizeConversationName(generatedName));
    } catch {
      setGenerateError(t(ConversationPanelI18nKeys.RenameWithAiError));
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, onGenerateWithAi, t]);

  let inputError: string | undefined;
  if (isTooLong) {
    inputError = t(ConversationPanelI18nKeys.RenameTitleTooLong);
  } else {
    inputError = generateError ?? error ?? undefined;
  }

  const renameWithAiLabel = t(ConversationPanelI18nKeys.RenameWithAiLabel);

  return (
    <DialFormPopup
      open={isOpen}
      header={t(ConversationPanelI18nKeys.RenameTitle)}
      size={PopupSize.Sm}
      onClose={onCancel}
      onCancel={onCancel}
      onSubmit={handleSave}
      cancelLabel={t(ButtonsI18nKeys.Cancel)}
      submitLabel={t(ButtonsI18nKeys.Save)}
      isLoading={isSaving}
      disableSubmitButton={isSaveDisabled}
    >
      <div className="flex items-center gap-2 px-6 py-2">
        <div className="min-w-0 flex-1">
          <DialInput
            inputRef={inputRef}
            value={value}
            placeholder={t(ConversationPanelI18nKeys.RenameInputPlaceholder)}
            error={inputError}
            onChange={(v) => setValue(sanitizeConversationName(v ?? ''))}
            onKeyDown={handleKeyDown}
          />
        </div>
        <DialGhostIconButton
          className="shrink-0"
          aria-label={renameWithAiLabel}
          tooltipProps={{ tooltip: renameWithAiLabel }}
          disabled={isGenerating || isSaving}
          onClick={handleGenerateWithAi}
          icon={
            isGenerating ? (
              <DialSpinner size={DIAL_ICON_SIZE.MD} />
            ) : (
              <IconSparkles size={DIAL_ICON_SIZE.MD} />
            )
          }
        />
      </div>
    </DialFormPopup>
  );
};

export default memo(RenameConversationPopup);

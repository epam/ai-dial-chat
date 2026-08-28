import {
  getUtf8ByteLength,
  sanitizeConversationName,
  stripTrailingDots,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonVariant,
  DIAL_ICON_SIZE,
  GhostIconButton,
  Input,
  Popup,
  PopupSize,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconSparkles } from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
import type { RenameConversationPopupProps } from '../../models/rename-conversation-popup';

export type {
  RenameConversationPopupLabels,
  RenameConversationPopupProps,
  RenameConversationPopupStyles,
} from '../../models/rename-conversation-popup';

/** Popup dialog for renaming a conversation, with validation and AI-generation affordance. */
export const RenameConversationPopup: FC<RenameConversationPopupProps> = memo(
  ({
    isOpen,
    currentTitle,
    isSaving,
    error,
    onSave,
    onCancel,
    onGenerateWithAi,
    labels,
    styles,
  }) => {
    const [value, setValue] = useState(currentTitle);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const wasOpenRef = useRef(false);
    const generationIdRef = useRef(0);

    useEffect(() => {
      const hasJustOpened = isOpen && !wasOpenRef.current;
      wasOpenRef.current = isOpen;
      if (!isOpen) {
        generationIdRef.current += 1;
        setIsGenerating(false);
        return undefined;
      }
      if (!hasJustOpened) return undefined;

      generationIdRef.current += 1;
      setValue(currentTitle);
      setGenerateError(null);
      setIsGenerating(false);
      /* Defer focus so the popup has time to mount and become visible. */
      const timeoutId = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timeoutId);
    }, [isOpen, currentTitle]);

    useEffect(
      () => () => {
        generationIdRef.current += 1;
      },
      [],
    );

    const trimmed = stripTrailingDots(value.trim());
    const isTooLong = getUtf8ByteLength(trimmed) > 255;
    const isSaveDisabled =
      isSaving ||
      trimmed === '' ||
      trimmed === currentTitle.trim() ||
      isTooLong;

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
      const generationId = ++generationIdRef.current;
      setIsGenerating(true);
      setGenerateError(null);
      try {
        const generatedName = await onGenerateWithAi();
        if (generationId !== generationIdRef.current) return;
        setValue(sanitizeConversationName(generatedName));
      } catch {
        if (generationId !== generationIdRef.current) return;
        setGenerateError(labels.renameWithAiError);
      } finally {
        if (generationId === generationIdRef.current) {
          setIsGenerating(false);
        }
      }
    }, [isGenerating, onGenerateWithAi, labels.renameWithAiError]);

    let inputError: string | undefined;
    if (isTooLong) {
      inputError = labels.nameTooLongError;
    } else {
      inputError = generateError ?? error ?? undefined;
    }

    return (
      <Popup
        open={isOpen}
        header={labels.popupTitle}
        size={PopupSize.Sm}
        onClose={onCancel}
        mainButtons={
          isSaving
            ? undefined
            : [
                { label: labels.cancelLabel, onClick: onCancel },
                {
                  label: labels.saveLabel,
                  variant: ButtonVariant.Primary,
                  disabled: isSaveDisabled,
                  onClick: handleSave,
                },
              ]
        }
      >
        <div className={styles?.bodyClassName} style={styles?.cssVars}>
          {isSaving ? (
            <div className="h-[120px] px-6 py-4">
              <Spinner size={50} />
            </div>
          ) : (
            <div className="flex items-start gap-2 px-6 py-3">
              <div className="min-w-0 flex-1">
                <Input
                  inputRef={inputRef}
                  value={value}
                  placeholder={labels.inputPlaceholder}
                  error={inputError}
                  onChange={(v) => setValue(sanitizeConversationName(v ?? ''))}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <GhostIconButton
                aria-label={labels.renameWithAiLabel}
                tooltipProps={{ tooltip: labels.renameWithAiLabel }}
                disabled={isGenerating || isSaving}
                onClick={handleGenerateWithAi}
                icon={
                  isGenerating ? (
                    <Spinner size={DIAL_ICON_SIZE.MD} />
                  ) : (
                    <IconSparkles size={DIAL_ICON_SIZE.MD} stroke={1.5} />
                  )
                }
              />
            </div>
          )}
        </div>
      </Popup>
    );
  },
);

RenameConversationPopup.displayName = 'RenameConversationPopup';

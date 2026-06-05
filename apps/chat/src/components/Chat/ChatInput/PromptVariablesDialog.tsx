import {
  ChangeEvent,
  FC,
  FocusEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { parseVariablesFromContent } from '@/src/utils/app/prompts';
import { onBlur } from '@/src/utils/app/style-helpers';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { PROMPT_VARIABLE_REGEX_GLOBAL } from '@/src/constants/folders';
import { SettingsI18nKeys } from '@/src/constants/i18n';

import { TemplateRenderer } from '@/src/components/Chat/ChatMessage/ChatMessageTemplatesModal/TemplateRenderer';
import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { EmptyRequiredInputMessage } from '@/src/components/Common/EmptyRequiredInputMessage';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface Props {
  prompt: Prompt;
  onSubmit: (updatedContent: string) => void;
  onClose: () => void;
}

export const PromptVariablesDialog: FC<Props> = ({
  prompt,
  onSubmit,
  onClose,
}) => {
  const variables = useMemo(
    () => parseVariablesFromContent(prompt.content),
    [prompt.content],
  );
  const [updatedVariables, setUpdatedVariables] = useState<
    { key: string; value: string }[]
  >(
    variables
      .map((variable) => ({ key: variable.name, value: variable.defaultValue }))
      .filter(
        (item, index, array) =>
          array.findIndex((t) => t.key === item.key) === index,
      ),
  );
  const [submitted, setSubmitted] = useState(false);

  const modalRef = useRef<HTMLFormElement>(null);
  const inputsRefs = useRef<HTMLTextAreaElement[] | null[]>([]);
  const { t } = useTranslation(Translation.Settings);

  const handleChange = useCallback(
    (index: number, e: ChangeEvent<HTMLTextAreaElement>) => {
      setUpdatedVariables((prev) => {
        const updated = [...prev];
        updated[index].value = e.target.value;
        return updated;
      });
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setSubmitted(true);
      if (inputsRefs.current.some((el) => !el?.validity.valid)) {
        return;
      }
      const content = prompt.content as string;

      const newContent = content.replace(
        PROMPT_VARIABLE_REGEX_GLOBAL,
        (_, variable) => {
          return updatedVariables.find((v) => v.key === variable)?.value ?? '';
        },
      );

      onSubmit(newContent);
      onClose();
    },
    [onClose, onSubmit, prompt.content, updatedVariables],
  );

  const handleOnBlur = useCallback(
    (index: number, e: FocusEvent<HTMLTextAreaElement>) => {
      e.target.value = e.target.value.trim();
      setUpdatedVariables((prev) => {
        const updated = [...prev];
        updated[index].value = e.target.value;
        return updated;
      });
      onBlur(e);
    },
    [],
  );

  const allowEnterClick = useAppSelector(UISelectors.selectAllowEnterToSend);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (allowEnterClick(e)) {
        e.preventDefault();
        handleSubmit(e);
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [allowEnterClick, handleSubmit, onClose],
  );

  useEffect(() => {
    inputsRefs.current?.[0]?.focus?.();
  }, []);

  const inputClassName = classNames('input-form', 'peer', {
    'input-invalid': submitted,
    submitted: submitted,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex max-h-full items-center justify-center overflow-hidden bg-blackout p-3 md:p-5"
      onKeyDown={handleKeyDown}
    >
      <form
        ref={modalRef}
        noValidate
        className="relative inline-block max-h-full w-full overflow-y-auto rounded bg-layer-3 px-3 py-4 text-start align-bottom transition-all md:p-6 xl:max-w-[720px] 2xl:max-w-[780px]"
        role="dialog"
        data-qa="variable-modal"
        onSubmit={handleSubmit}
      >
        <Tooltip
          tooltip={prompt.name}
          triggerClassName="mb-4 truncate whitespace-pre text-base font-bold block"
          contentClassName="break-all"
          dataQa="variable-prompt-name"
        >
          {prompt.name}
        </Tooltip>

        {prompt.description && (
          <div
            className="mb-5 whitespace-pre-wrap italic"
            data-qa="variable-prompt-descr"
          >
            <TemplateRenderer template={prompt.description} />
          </div>
        )}

        <CloseButtonSmall
          className="absolute right-2 top-2"
          onClick={onClose}
        />

        {updatedVariables.map((variable, index) => (
          <div className="mb-4" key={variable.key} data-qa="variable">
            <div className="mb-1 flex text-xs text-secondary">
              <span className="break-all" data-qa="variable-label">
                {variable.key}
              </span>
              <span
                className="ml-1 inline text-accent-primary"
                data-qa="variable-asterisk"
              >
                *
              </span>
            </div>

            <textarea
              ref={(el) => {
                inputsRefs.current[index] = el;
              }}
              className={inputClassName}
              style={{ resize: 'none' }}
              required
              title=""
              placeholder={t(SettingsI18nKeys.EnterAValueForKey, {
                key: variable.key,
              })}
              value={variable.value}
              onBlur={(e) => {
                handleOnBlur(index, e);
              }}
              onChange={(e) => {
                handleChange(index, e);
              }}
              rows={3}
            />
            <EmptyRequiredInputMessage
              text={SettingsI18nKeys.PleaseFillOutAllVariables}
            />
          </div>
        ))}

        <div className="mt-1 flex justify-end">
          <DialPrimaryButton
            label={t(SettingsI18nKeys.Submit)}
            type="submit"
            data-qa="submit-variable"
          />
        </div>
      </form>
    </div>
  );
};

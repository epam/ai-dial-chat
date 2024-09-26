import { IconChevronDown, IconTrashX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FocusEvent,
  LegacyRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { templateMatchContent } from '@/src/utils/app/prompts';

import { Conversation, Message } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';

import Modal from '@/src/components/Common/Modal';

import { TabButton } from '../../Buttons/TabButton';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
interface TemplateInputProps extends TextareaProps {
  validationError?: string;
  dataQA?: string;
}

const TemplateInput = forwardRef(
  (
    { dataQA, validationError, className, ...rest }: TemplateInputProps,
    ref: LegacyRef<HTMLTextAreaElement> | undefined,
  ) => (
    <div className="flex grow flex-col text-left">
      <textarea
        {...rest}
        ref={ref}
        className={classNames(
          className,
          'min-h-11 w-full grow resize-y whitespace-pre-wrap rounded border bg-transparent px-4 py-3 outline-none placeholder:text-secondary focus-visible:outline-none',
          !validationError
            ? 'border-primary focus-within:border-accent-primary'
            : 'border-error hover:border-error focus:border-error',
        )}
        rows={3}
        data-qa={dataQA ?? 'template-input'}
      />
      {validationError && (
        <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
          {validationError}
        </span>
      )}
    </div>
  ),
);
TemplateInput.displayName = 'TemplateInput';

interface TemplateRowProps {
  index: number;
  content: string;
  template: string;
  lastRow: boolean;
  originalMessage: string;
  onChange: (index: number, content: string, template: string) => void;
  onDelete: (index: number) => void;
}

const TemplateRow = ({
  index,
  content,
  template,
  lastRow,
  originalMessage,
  onChange,
  onDelete,
}: TemplateRowProps) => {
  const { t } = useTranslation(Translation.Chat);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const [validationContentError, setValidationContentError] = useState('');
  const [validationTemplateError, setValidationTemplateError] = useState('');
  const validate = useCallback(
    (element: HTMLTextAreaElement) => {
      if (lastRow) return;
      const setMethod =
        element === contentRef.current
          ? setValidationContentError
          : setValidationTemplateError;
      if (!element.value) {
        setMethod(t("Value can't be empty") ?? '');
        return;
      }
      if (
        element === contentRef.current &&
        contentRef.current?.value &&
        originalMessage.indexOf(contentRef.current.value) === -1
      ) {
        setValidationContentError(
          t('This parts was not found into original message') ?? '',
        );
        return;
      }
      if (
        templateRef.current?.value &&
        !PROMPT_VARIABLE_REGEX.test(templateRef.current.value)
      ) {
        setValidationTemplateError(
          t('Template must have at least one variable') ?? '',
        );
        return;
      }
      const matchError = t("Template doesn't match the message text") ?? '';
      if (
        contentRef.current?.value &&
        templateRef.current?.value &&
        !templateMatchContent(
          contentRef.current.value,
          templateRef.current.value,
        )
      ) {
        setValidationTemplateError(matchError);
        return;
      } else if (validationTemplateError === matchError) {
        setValidationTemplateError('');
        return;
      }
      setMethod('');
    },
    [lastRow, originalMessage, validationTemplateError],
  );
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(
        index,
        contentRef.current?.value ?? '',
        templateRef.current?.value ?? '',
      );
      validate(event.target);
    },
    [index, onChange, validate],
  );

  const handleDelete = useCallback(() => onDelete(index), [index, onDelete]);

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      validate(event.target);
    },
    [validate],
  );

  useEffect(() => {
    const handleResize = (ref: React.RefObject<HTMLTextAreaElement>) => () => {
      if (ref.current) {
        const height = ref.current.scrollHeight + 2;
        if (ref === contentRef) {
          if (templateRef.current) {
            templateRef.current.style.height = `${height}px`;
          }
        } else {
          if (contentRef.current) {
            contentRef.current.style.height = `${height}px`;
          }
        }
      }
    };

    const contentResizeObserver = new ResizeObserver(handleResize(contentRef));
    const templateResizeObserver = new ResizeObserver(
      handleResize(templateRef),
    );

    if (contentRef.current) {
      contentResizeObserver.observe(contentRef.current);
    }

    if (templateRef.current) {
      templateResizeObserver.observe(templateRef.current);
    }

    return () => {
      contentResizeObserver.disconnect();
      templateResizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="flex items-start gap-2 pb-3">
      <TemplateInput
        value={content}
        dataQA="template-content"
        placeholder="Part of message"
        ref={contentRef}
        onChange={handleChange}
        onBlur={handleBlur}
        validationError={validationContentError}
      />
      <TemplateInput
        value={template}
        dataQA="template-value"
        placeholder="Template"
        ref={templateRef}
        onChange={handleChange}
        onBlur={handleBlur}
        validationError={validationTemplateError}
      />
      <IconTrashX
        size={24}
        className={classNames(
          'shrink-0 cursor-pointer self-center text-secondary hover:text-accent-primary',
          lastRow && 'invisible',
          (validationContentError || validationTemplateError) && 'mb-5',
        )}
        onClick={handleDelete}
      />
    </div>
  );
};

interface Props {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  message: Message;
  conversation: Conversation;
}

const emptyRow = ['', ''];

export const ChatMessageTemplatesModal = ({
  isOpen,
  onClose,
  message,
  conversation,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const showMore = message.content.length > 160;
  const [collapsed, setCollapsed] = useState(showMore);
  const [previewMode, setPreviewMode] = useState(false);
  const [templates, setTemplates] = useState([
    ...Object.entries(message.templateMapping ?? {}),
    emptyRow,
  ]);

  useEffect(() => {
    if (isOpen) {
      setTemplates([
        ...Object.entries(message.templateMapping ?? {}),
        emptyRow,
      ]);
    }
  }, [message.templateMapping, isOpen]);

  const handleChangeTemplate = useCallback(
    (index: number, content: string, template: string) => {
      const newTemplates = [...templates];
      newTemplates[index] = [content, template];
      if (index === newTemplates.length - 1 && (content || template)) {
        newTemplates.push(emptyRow);
      }
      setTemplates(newTemplates);
    },
    [templates],
  );

  const handleDeleteTemplate = useCallback(
    (index: number) => {
      const newTemplates = [...templates];
      newTemplates.splice(index, 1);
      setTemplates(newTemplates);
    },
    [templates],
  );

  const handleSaveTemplate = useCallback(() => {
    const templateMapping = Object.fromEntries(
      templates.slice(0, templates.length - 1),
    );
    const messages = conversation.messages.map((mes) =>
      mes === message ? { ...mes, templateMapping } : mes,
    );
    dispatch(
      ConversationsActions.updateConversation({
        id: conversation.id,
        values: {
          messages,
        },
      }),
    );
    onClose(true);
  }, [
    conversation.id,
    conversation.messages,
    dispatch,
    message,
    onClose,
    templates,
  ]);

  const templateResult = useMemo(() => {
    return templates.reduce(
      (acc, [key, value]) => acc.replaceAll(key, value),
      message.content,
    );
  }, [message.content, templates]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="message-templates-dialog"
      containerClassName="h-fit max-h-full inline-block w-full min-w-[90%] text-center md:min-w-[300px] md:max-w-[880px] flex flex-col"
      dismissProps={{ outsidePressEvent: 'mousedown', outsidePress: true }}
      heading={t('Message template')}
      headingClassName="px-6 pt-4"
    >
      <div className="flex min-h-20 shrink flex-col justify-between divide-y divide-tertiary">
        <div className="flex min-h-0 shrink flex-col divide-y divide-tertiary overflow-y-auto">
          <div className="flex w-full flex-col gap-2 px-6 pb-4 text-start">
            <p
              data-qa="description"
              className="whitespace-pre-wrap text-primary"
            >
              Copy part of message into first input and provide template with
              template variables into second input
            </p>
            <p
              data-qa="original-message-label"
              className="whitespace-pre-wrap text-secondary"
            >
              Original message:
            </p>
            <div
              data-qa="original-message-content"
              className="whitespace-pre-wrap text-primary"
            >
              {collapsed
                ? `${message.content.trim().slice(0, 157).trim()}...`
                : message.content}
              {showMore && (
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="mt-3 flex leading-5 text-accent-primary"
                  data-qa={showMore ? 'show-less' : 'show-more'}
                >
                  {!collapsed ? 'Show less' : 'Show more'}
                  <IconChevronDown
                    height={18}
                    width={18}
                    className={classNames(
                      'ml-1 shrink-0 transition',
                      !collapsed && 'rotate-180',
                    )}
                  />
                </button>
              )}
            </div>
          </div>
          <div
            data-qa="templates"
            className="flex flex-col whitespace-pre-wrap px-6 py-4"
          >
            <div className="mb-4 flex gap-4">
              <TabButton
                selected={!previewMode}
                onClick={() => setPreviewMode(false)}
                dataQA="save-button"
              >
                {t('Set template')}
              </TabButton>
              <TabButton
                selected={previewMode}
                onClick={() => setPreviewMode(true)}
                dataQA="save-button"
              >
                Preview
              </TabButton>
            </div>
            <div className="relative">
              <div className={classNames(previewMode && 'invisible')}>
                {templates.map(([key, value], index) => (
                  <TemplateRow
                    key={index}
                    index={index}
                    content={key}
                    template={value}
                    lastRow={index === templates.length - 1}
                    originalMessage={message.content}
                    onChange={handleChangeTemplate}
                    onDelete={handleDeleteTemplate}
                  />
                ))}
              </div>
              <div
                className={classNames(
                  'absolute inset-y-0 size-full overflow-y-auto',
                  !previewMode && 'hidden',
                )}
              >
                <div
                  data-qa="result-message-template"
                  className="whitespace-pre-wrap text-left text-primary"
                >
                  {templateResult}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full items-center justify-end gap-3 px-6 py-4">
          <button
            className="button button-primary"
            onClick={handleSaveTemplate}
            data-qa="save-button"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

import { IconChevronDown, IconTrashX } from '@tabler/icons-react';
import { LegacyRef, forwardRef, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation, Message } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import Modal from '@/src/components/Common/Modal';

import { TabButton } from '../../Buttons/TabButton';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
interface TemplateInputProps extends TextareaProps {
  validationError?: string;
  dataQA?: string;
}

const TemplateInput = forwardRef(
  (
    { dataQA, ...rest }: TemplateInputProps,
    ref: LegacyRef<HTMLTextAreaElement> | undefined,
  ) => (
    <textarea
      {...rest}
      ref={ref}
      className="min-h-11 w-full grow resize-y whitespace-pre-wrap rounded border border-primary bg-transparent px-4 py-3 outline-none placeholder:text-secondary focus-within:border-accent-primary focus-visible:outline-none"
      rows={3}
      data-qa={dataQA ?? 'template-input'}
    />
  ),
);
TemplateInput.displayName = 'TemplateInput';

interface TemplateRowProps {
  content: string;
  template: string;
  hideDelete: boolean;
}

const TemplateRow = ({ content, template, hideDelete }: TemplateRowProps) => {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const handleResize = (ref: React.RefObject<HTMLTextAreaElement>) => {
    if (ref.current) {
      if (ref === contentRef) {
        if (templateRef.current) {
          templateRef.current.style.height = `${ref.current.scrollHeight}px`;
        }
      } else if (contentRef.current) {
        contentRef.current.style.height = `${ref.current.scrollHeight}px`;
      }
    }
  };

  useEffect(() => {
    const handleResize = (ref: React.RefObject<HTMLTextAreaElement>) => () => {
      if (ref.current) {
        if (ref === contentRef) {
          if (templateRef.current) {
            templateRef.current.style.height = `${ref.current.scrollHeight}px`;
          }
        } else {
          if (contentRef.current) {
            contentRef.current.style.height = `${ref.current.scrollHeight}px`;
          }
        }
      }
    };

    const resizeObserver1 = new ResizeObserver(handleResize(contentRef));
    const resizeObserver2 = new ResizeObserver(handleResize(contentRef));

    if (contentRef.current) {
      resizeObserver1.observe(contentRef.current);
    }

    if (templateRef.current) {
      resizeObserver2.observe(templateRef.current);
    }

    return () => {
      resizeObserver1.disconnect();
      resizeObserver2.disconnect();
    };
  }, []);

  return (
    <div className="flex items-center gap-2 overflow-y-auto pb-3" key={content}>
      <TemplateInput
        value={content}
        dataQA="template-content"
        placeholder="Part of message"
        ref={contentRef}
        onInput={() => handleResize(contentRef)}
      />
      <TemplateInput
        value={template}
        dataQA="template-value"
        placeholder="Template"
        ref={templateRef}
        onInput={() => handleResize(templateRef)}
      />
      <IconTrashX
        size={24}
        className={classNames(
          'shrink-0 cursor-pointer text-secondary hover:text-accent-primary',
          hideDelete && 'invisible',
        )}
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

export const ChatMessageTemplatesModal = ({
  isOpen,
  onClose,
  message,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const showMore = message.content.length > 160;
  const [collapsed, setCollapsed] = useState(showMore);
  const [previewMode, setPreviewMode] = useState(false);
  const [templates /*, setTemplates*/] = useState([
    ...Object.entries(message.templateMapping ?? {}),
    ['', ''],
  ]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dataQa="message-templates-dialog"
      containerClassName="h-fit max-h-full inline-block w-full min-w-[90%] text-center md:min-w-[300px] md:max-w-[500px]"
      dismissProps={{ outsidePressEvent: 'mousedown', outsidePress: true }}
      heading={t('Message template')}
      headingClassName="px-6 pt-4"
    >
      <div className="flex flex-col justify-between divide-y divide-tertiary">
        <div className="flex w-full flex-col gap-2 px-6 pb-4 text-start">
          <p data-qa="description" className="whitespace-pre-wrap text-primary">
            Copy part of message into first input and provide template with
            template variables into second input
          </p>
          <p
            data-qa="original-message-label"
            className="whitespace-pre-wrap text-secondary"
          >
            Original message:
          </p>
          <p
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
          </p>
        </div>
        <div data-qa="templates" className="whitespace-pre-wrap px-6 py-4">
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
          {!previewMode &&
            templates.map(([key, value], index) => (
              <TemplateRow
                key={key}
                content={key}
                template={value}
                hideDelete={index === templates.length - 1}
              />
            ))}
          {previewMode && (
            <div
              data-qa="original-message-content"
              className="overflow-y-auto whitespace-pre-wrap text-primary"
            >
              {message.content}
            </div>
          )}
        </div>
        <div className="flex w-full items-center justify-end gap-3 px-6 py-4">
          <button
            className="button button-primary"
            onClick={() => onClose(true)}
            data-qa="save-button"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

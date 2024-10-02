import { UseDismissProps } from '@floating-ui/react';
import { IconChevronDown } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { templateMatchContent } from '@/src/utils/app/prompts';

import { Conversation } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';

import Modal from '@/src/components/Common/Modal';

import { TabButton } from '../../../Buttons/TabButton';
import { TemplateRenderer } from './TemplateRenderer';
import { TemplateRow } from './TemplateRow';

import { Message } from '@epam/ai-dial-shared';

interface Props {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  message: Message;
  conversation: Conversation;
}

const EMPTY_ROW = ['', ''];
const dismissProps: UseDismissProps = {
  outsidePressEvent: 'mousedown',
  outsidePress: true,
};

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
    EMPTY_ROW,
  ]);

  useEffect(() => {
    if (isOpen) {
      setTemplates([
        ...Object.entries(message.templateMapping ?? {}),
        EMPTY_ROW,
      ]);
    }
  }, [message.templateMapping, isOpen]);

  const handleChangeTemplate = useCallback(
    (index: number, content: string, template: string) => {
      const newTemplates = [...templates];
      newTemplates[index] = [content, template];
      if (index === newTemplates.length - 1 && (content || template)) {
        newTemplates.push(EMPTY_ROW);
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

  const isInvalid = useMemo(
    () =>
      templates
        .slice(0, templates.length - 1)
        .some(
          ([content, template]) =>
            !content ||
            !template ||
            message.content.indexOf(content) === -1 ||
            !PROMPT_VARIABLE_REGEX.test(template) ||
            !templateMatchContent(content, template),
        ),
    [message.content, templates],
  );

  const handleClose = useCallback(() => onClose(false), [onClose]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleClose}
      dataQa="message-templates-dialog"
      containerClassName="h-fit max-h-full inline-block w-full min-w-[90%] text-center md:min-w-[300px] md:max-w-[880px] flex flex-col"
      dismissProps={dismissProps}
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
              {t(
                'Copy part of message into first input and provide template with template variables into second input',
              )}
            </p>
            <p
              data-qa="original-message-label"
              className="whitespace-pre-wrap text-secondary"
            >
              {t('Original message:')}
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
                {t('Preview')}
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
                  <TemplateRenderer template={templateResult} />
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
            disabled={isInvalid}
          >
            {t('Save')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

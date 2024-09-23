import { IconChevronDown, IconTrashX } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation, Message } from '@/src/types/chat';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import Modal from '@/src/components/Common/Modal';

import { TabButton } from '../../Buttons/TabButton';
import { AdjustedTextarea } from './AdjustedTextarea';

interface InputProps {
  value: string;
  validationError?: string;
}

const TemplateInput = ({ value }: InputProps) => (
  <AdjustedTextarea
    className="w-full grow resize-none whitespace-pre-wrap rounded border border-primary bg-transparent px-4 py-3 outline-none placeholder:text-secondary focus-within:border-accent-primary focus-visible:outline-none"
    value={value}
  />
);

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
          {!previewMode && (
            <div className="flex items-center gap-2 overflow-y-auto">
              <TemplateInput value="English is 1st" />
              <TemplateInput value="{{Language}} is {{Place}}" />
              <IconTrashX
                size={24}
                className="shrink-0 cursor-pointer text-secondary hover:text-accent-primary"
              />
            </div>
          )}
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

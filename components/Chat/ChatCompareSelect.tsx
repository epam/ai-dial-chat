import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Select, {
  ClassNamesConfig,
  NoticeProps,
  OptionProps,
  SingleValueProps,
  components,
} from 'react-select';

import { Conversation } from '@/types/chat';

import { SelectIcon } from '../Select/SelectIcon';

interface Props {
  conversations: Conversation[];
  selectedConversations: Conversation[];
  onConversationSelect: (conversation: Conversation) => void;
}

interface CompareOption {
  value: string;
  label: string;
  modelId: string;
}

const NoConversationsMessage: FC<NoticeProps<CompareOption>> = (props) => {
  const { t } = useTranslation('chat');
  return (
    <components.NoOptionsMessage {...props}>
      {t('No conversations available')}
    </components.NoOptionsMessage>
  );
};

const CustomSelectOption = (props: OptionProps<CompareOption>) => {
  const { data, children, isFocused } = props;
  return (
    <>
      <components.Option
        {...props}
        className={`!p-1 !pl-4 hover:cursor-pointer dark:text-white/80  hover:dark:bg-[#202123] 
        ${isFocused ? 'dark:bg-[#202123]' : 'dark:bg-[#40414F]'}
        `}
      >
        <SelectIcon modelId={data.modelId}>{children}</SelectIcon>
      </components.Option>
    </>
  );
};

const CustomSingleValue = (props: SingleValueProps<CompareOption>) => {
  const { children, getValue } = props;
  const selectedOption = getValue()[0];
  return (
    <components.SingleValue className="!pl-1" {...props}>
      {selectedOption ? (
        <SelectIcon modelId={selectedOption.value}>{children}</SelectIcon>
      ) : (
        children
      )}
    </components.SingleValue>
  );
};

const selectClassNames: ClassNamesConfig<CompareOption> = {
  control: (state) =>
    `dark:bg-[#40414F] dark:text-white/80 hover:dark:border-white hover:dark:shadow-white  !rounded-lg ${
      state.isFocused
        ? 'dark:border-white/80 dark:shadow-white/80 dark:shadow-sm'
        : ''
    }`,
  placeholder: () => 'text-neutral-900 dark:text-white/80',
  valueContainer: () => '!text-neutral-900 hover:cursor-text',
  menu: () =>
    '!mt-1 dark:bg-[#40414F] !rounded !shadow-sm !shadow-neutral-400 dark:!shadow-[#717283]',
  singleValue: () => '!text-neutral-900 dark:!text-white/80 center m-0',
  dropdownIndicator: () =>
    '!py-0 hover:!text-neutral-900 hover:dark:!text-white/80',
  input: () => 'dark:!text-white/80',
};

export const ChatCompareSelect = ({
  conversations,
  selectedConversations,
  onConversationSelect,
}: Props) => {
  const { t } = useTranslation('chat');
  const [comparableConversations, setComparableConversations] = useState<
    Conversation[]
  >([]);

  const comparableOptions: CompareOption[] = comparableConversations.map(
    (conversation) => {
      return {
        value: conversation.id,
        label: conversation.name,
        modelId: conversation.model.id,
      };
    },
  );

  const placeholder: string =
    comparableConversations.length === 0
      ? t('No conversations available')
      : t('Select conversation');

  const handleOnChange = (option: CompareOption | null) => {
    if (option) {
      const selectedOption = conversations
        .filter((val) => val.id === option.value)
        .pop();

      if (selectedOption) {
        onConversationSelect(selectedOption);
      }
    }
  };

  useEffect(() => {
    if (selectedConversations.length === 1) {
      const selectedConversation = selectedConversations[0];

      const comparableConversations = conversations.filter((conv) => {
        if (conv.id === selectedConversation.id) {
          return false;
        }
        const convUserMessages = conv.messages.filter(
          (message) => message.role === 'user',
        );
        const selectedConvUserMessages = selectedConversation.messages.filter(
          (message) => message.role === 'user',
        );

        if (convUserMessages.length !== selectedConvUserMessages.length) {
          return false;
        }

        let isNotSame = false;
        for (let i = 0; i < convUserMessages.length; i++) {
          if (
            convUserMessages[i].content !== selectedConvUserMessages[i].content
          ) {
            isNotSame = true;
          }
          break;
        }

        if (isNotSame) {
          return false;
        }

        return true;
      });
      setComparableConversations(comparableConversations);
    }
  }, [conversations, selectedConversations]);

  return (
    <div className="text-black/80 flex h-full flex-col items-center justify-center text-base dark:text-white/80">
      <div className="mb-5 flex max-w-[300px] flex-col text-center">
        <h5>{t('Select conversation to compare with')}</h5>
        <i>
          (
          {t(
            'Note: only conversations with same user messages can be compared',
          )}
          )
        </i>
      </div>

      <Select<CompareOption>
        className="!border-gray-900/50 text-black/80 !min-w-[220px] !rounded-md border text-base dark:bg-[#40414F] dark:text-white/80"
        classNames={selectClassNames}
        options={comparableOptions}
        placeholder={placeholder}
        onChange={handleOnChange}
        components={{
          NoOptionsMessage: NoConversationsMessage,
          Option: CustomSelectOption,
          SingleValue: CustomSingleValue,
        }}
      />
    </div>
  );
};

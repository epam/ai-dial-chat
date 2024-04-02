import { IconBulb, IconFile } from '@tabler/icons-react';
import {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { ConversationInfo } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import {
  MappedReplaceActions,
  ReplaceOptions,
} from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { Select, SelectOption } from '../Select';
import Tooltip from '../Tooltip';

interface ReplaceSelectorProps {
  selectedOption: ReplaceOptions;
  onOptionChangeHandler: (optionId: string) => void;
}

export const ReplaceSelector = ({
  selectedOption,
  onOptionChangeHandler,
}: ReplaceSelectorProps) => {
  const { t } = useTranslation(Translation.Chat);
  const replaceSelectorOptions: SelectOption[] = [
    ReplaceOptions.Postfix,
    ReplaceOptions.Replace,
    ReplaceOptions.Ignore,
  ].map((option) => ({
    id: option,
    displayName: t(option),
  }));

  return (
    <Select
      options={replaceSelectorOptions}
      selectedOptionName={t(selectedOption)}
      onOptionChangeHandler={onOptionChangeHandler}
      optionClassName="pl-5"
    />
  );
};

interface EntityRowProps {
  children?: ReactElement;
  additionalItemData?: Record<string, unknown>;
  entityId: string;
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
}

export const EntityRow = ({
  level,
  children,
  entityId,
  additionalItemData,
  onEvent,
}: EntityRowProps) => {
  const [selectedOption, setSelectedOption] = useState<ReplaceOptions>(
    ReplaceOptions.Postfix,
  );

  const mappedActions = useMemo(
    () =>
      additionalItemData &&
      (additionalItemData as { mappedActions: MappedReplaceActions })
        .mappedActions,
    [additionalItemData],
  );

  const onOptionChangeHandler = useCallback(
    (option: string) => {
      const typedOption = option as ReplaceOptions;
      onEvent && onEvent(typedOption, entityId);
      setSelectedOption(typedOption);
    },
    [onEvent, entityId],
  );

  useEffect(() => {
    setSelectedOption(() =>
      mappedActions ? mappedActions[entityId] : ReplaceOptions.Postfix,
    );
  }, [additionalItemData, mappedActions, entityId]);

  return (
    <div
      className="flex justify-between hover:bg-accent-primary-alpha"
      style={{
        paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
      }}
    >
      {children}
      <ReplaceSelector
        selectedOption={selectedOption}
        onOptionChangeHandler={onOptionChangeHandler}
      />
    </div>
  );
};

interface FeatureContainerProps {
  children: ReactNode | ReactNode[];
}
const FeatureContainer = ({ children }: FeatureContainerProps) => (
  <span className="flex w-2/3 flex-row items-center gap-2">{children}</span>
);

interface ConversationViewProps {
  item: ConversationInfo;
}

const ConversationView = ({ item: conversation }: ConversationViewProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <FeatureContainer>
      <ModelIcon
        size={18}
        entityId={conversation.model.id}
        entity={modelsMap[conversation.model.id]}
      />
      <Tooltip
        tooltip={conversation.name}
        triggerClassName="truncate text-center w-full"
      >
        <div className="truncate whitespace-pre break-all text-left">
          {conversation.name}
        </div>
      </Tooltip>
    </FeatureContainer>
  );
};

export interface ConversationRowProps extends ConversationViewProps {
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: Record<string, unknown>;
}

export const ConversationRow = ({
  level,
  item: conversation,
  additionalItemData,
  onEvent,
}: ConversationRowProps) => {
  return (
    <EntityRow
      entityId={conversation.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
    >
      <ConversationView item={conversation} />
    </EntityRow>
  );
};

interface PromptViewProps {
  item: Prompt;
}

const PromptView = ({ item: prompt }: PromptViewProps) => {
  return (
    <FeatureContainer>
      <IconBulb size={18} className="text-secondary" />
      <Tooltip
        tooltip={prompt.name}
        triggerClassName="truncate text-center w-full"
      >
        <div className="truncate whitespace-pre break-all text-left">
          {prompt.name}
        </div>
      </Tooltip>
    </FeatureContainer>
  );
};

export interface PromptRowProps extends PromptViewProps {
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: Record<string, unknown>;
}

export const PromptsRow = ({
  level,
  item: prompt,
  additionalItemData,
  onEvent,
}: PromptRowProps) => {
  return (
    <EntityRow
      entityId={prompt.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
    >
      <PromptView item={prompt} />
    </EntityRow>
  );
};

interface FileViewProps {
  item: DialFile;
}

const FileView = ({ item: file }: FileViewProps) => {
  return (
    <FeatureContainer>
      <IconFile size={18} className="text-secondary" />
      <Tooltip
        tooltip={file.name}
        triggerClassName="truncate text-center w-full"
      >
        <div className="truncate whitespace-pre break-all text-left">
          {file.name}
        </div>
      </Tooltip>
    </FeatureContainer>
  );
};

export interface FileRowProps extends FileViewProps {
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: Record<string, unknown>;
}

export const FilesRow = ({
  level,
  item,
  additionalItemData,
  onEvent,
}: FileRowProps) => {
  return (
    <EntityRow
      entityId={item.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
    >
      <FileView item={item} />
    </EntityRow>
  );
};

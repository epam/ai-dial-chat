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

import classNames from 'classnames';

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
  entityRowClassNames?: string;
}

export const EntityRow = ({
  level,
  children,
  entityId,
  additionalItemData,
  onEvent,
  entityRowClassNames,
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
      className={classNames(
        'flex h-[38px] justify-between hover:rounded hover:bg-accent-primary-alpha',
        entityRowClassNames,
      )}
      style={{
        paddingLeft: (level && `${0.875 + level * 1.5}rem`) || '0.875rem',
      }}
    >
      {children}
      {!!mappedActions && (
        <ReplaceSelector
          selectedOption={selectedOption}
          onOptionChangeHandler={onOptionChangeHandler}
        />
      )}
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
        contentClassName="max-w-[400px]"
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
  itemComponentClassNames?: string;
}

export const ConversationRow = ({
  level,
  item: conversation,
  additionalItemData,
  onEvent,
  itemComponentClassNames,
}: ConversationRowProps) => {
  return (
    <EntityRow
      entityId={conversation.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
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
        contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
        triggerClassName="truncate whitespace-pre"
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
  itemComponentClassNames?: string;
}

export const PromptsRow = ({
  level,
  item: prompt,
  additionalItemData,
  onEvent,
  itemComponentClassNames,
}: PromptRowProps) => {
  return (
    <EntityRow
      entityId={prompt.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
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
        contentClassName="max-w-[400px]"
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
  itemComponentClassNames?: string;
}

export const FilesRow = ({
  level,
  item,
  additionalItemData,
  onEvent,
  itemComponentClassNames,
}: FileRowProps) => {
  return (
    <EntityRow
      entityId={item.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
    >
      <FileView item={item} />
    </EntityRow>
  );
};

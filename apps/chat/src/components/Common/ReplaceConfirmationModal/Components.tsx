import { IconBulb, IconCheck, IconFile } from '@tabler/icons-react';
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
import { PublishActions } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { PlaybackIcon } from '../../Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '../../Chat/ReplayAsIsIcon';
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
  selectorGroup?: string;
}
const FeatureContainer = ({ children }: FeatureContainerProps) => (
  <span className="flex w-2/3 flex-row items-center gap-2">{children}</span>
);

interface ConversationViewProps {
  item: ConversationInfo;
  onSelect?: (ids: string[]) => void;
  isChosen?: boolean;
}

const ConversationView = ({
  item: conversation,
  onSelect,
  isChosen,
}: ConversationViewProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <FeatureContainer>
      {onSelect && (
        <div className="relative flex size-[18px] shrink-0">
          <input
            className="checkbox peer size-[18px] bg-layer-3"
            type="checkbox"
            checked={isChosen}
            onChange={() => {
              onSelect([conversation.id]);
            }}
          />
          <IconCheck
            size={18}
            className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
          />
        </div>
      )}
      {conversation.isReplay && (
        <span className="flex shrink-0">
          <ReplayAsIsIcon size={18} />
        </span>
      )}
      {conversation.isPlayback && (
        <span className="flex shrink-0">
          <PlaybackIcon size={18} />
        </span>
      )}
      {!conversation.isReplay && !conversation.isPlayback && (
        <ModelIcon
          size={18}
          entityId={conversation.model.id}
          entity={modelsMap[conversation.model.id]}
        />
      )}
      <Tooltip
        tooltip={conversation.name}
        contentClassName="max-w-[400px] break-all"
        triggerClassName={classNames(
          'truncate whitespace-pre',
          conversation.publicationInfo?.isNotExist && 'text-secondary',
          conversation.publicationInfo?.action === PublishActions.DELETE &&
            'text-error',
        )}
      >
        {conversation.name}
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
  onSelect,
  isChosen,
}: ConversationRowProps) => {
  return (
    <EntityRow
      entityId={conversation.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
    >
      <ConversationView
        isChosen={isChosen}
        onSelect={onSelect}
        item={conversation}
      />
    </EntityRow>
  );
};

interface PromptViewProps {
  item: Prompt;
  onSelect?: (ids: string[]) => void;
  isChosen?: boolean;
}

const PromptView = ({ item: prompt, onSelect, isChosen }: PromptViewProps) => {
  return (
    <FeatureContainer>
      {onSelect && (
        <div className="relative flex size-[18px] shrink-0">
          <input
            className="checkbox peer size-[18px] bg-layer-3"
            type="checkbox"
            checked={isChosen}
            onChange={() => {
              onSelect([prompt.id]);
            }}
          />
          <IconCheck
            size={18}
            className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
          />
        </div>
      )}
      <span className="flex shrink-0">
        <IconBulb size={18} className="text-secondary" />
      </span>
      <Tooltip
        tooltip={prompt.name}
        contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
        triggerClassName={classNames(
          'truncate whitespace-pre',
          prompt.publicationInfo?.isNotExist && 'text-secondary',
          prompt.publicationInfo?.action === PublishActions.DELETE &&
            'text-error',
        )}
      >
        {prompt.name}
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
  isChosen,
  onSelect,
}: PromptRowProps) => {
  return (
    <EntityRow
      entityId={prompt.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
    >
      <PromptView isChosen={isChosen} onSelect={onSelect} item={prompt} />
    </EntityRow>
  );
};

interface FileViewProps {
  item: DialFile;
  onSelect?: (ids: string[]) => void;
  isChosen?: boolean;
}

const FileView = ({ item: file, onSelect, isChosen }: FileViewProps) => {
  return (
    <FeatureContainer>
      {onSelect && (
        <div className={'relative flex size-[18px] shrink-0'}>
          <input
            className="checkbox peer size-[18px] bg-layer-3"
            type="checkbox"
            checked={isChosen}
            onChange={() => {
              onSelect([file.id]);
            }}
          />
          <IconCheck
            size={18}
            className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
          />
        </div>
      )}
      <span className="flex shrink-0">
        <IconFile size={18} className="text-secondary" />
      </span>
      <Tooltip
        tooltip={file.name}
        contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
        triggerClassName={classNames(
          'truncate whitespace-pre',
          file.publicationInfo?.isNotExist &&
            'bg-controls-disable text-secondary',
          file.publicationInfo?.action === PublishActions.DELETE &&
            'text-error',
        )}
      >
        {file.name}
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
  isChosen,
  onSelect,
}: FileRowProps) => {
  return (
    <EntityRow
      entityId={item.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
    >
      <FileView onSelect={onSelect} isChosen={isChosen} item={item} />
    </EntityRow>
  );
};

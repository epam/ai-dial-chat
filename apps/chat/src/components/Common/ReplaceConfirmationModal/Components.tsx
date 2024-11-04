import { IconBulb, IconCheck, IconFile } from '@tabler/icons-react';
import {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getFolderIdFromEntityId } from '@/src/utils/app/folders';

import {
  AdditionalItemData,
  EntityType,
  FeatureType,
} from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ReplaceOptions } from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { PlaybackIcon } from '../../Chat/Playback/PlaybackIcon';
import { ReplayAsIsIcon } from '../../Chat/ReplayAsIsIcon';
import { ModelIcon } from '../../Chatbar/ModelIcon';
import { Select, SelectOption } from '../Select';
import ShareIcon from '../ShareIcon';
import Tooltip from '../Tooltip';

import {
  ConversationInfo,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

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
  additionalItemData?: AdditionalItemData;
  entityId: string;
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  entityRowClassNames?: string;
  dataQA?: string;
}

export const EntityRow = ({
  level,
  children,
  entityId,
  additionalItemData,
  onEvent,
  entityRowClassNames,
  dataQA,
}: EntityRowProps) => {
  const [selectedOption, setSelectedOption] = useState<ReplaceOptions>(
    ReplaceOptions.Postfix,
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
    setSelectedOption(
      () =>
        additionalItemData?.mappedActions?.[entityId] ?? ReplaceOptions.Postfix,
    );
  }, [additionalItemData, additionalItemData?.mappedActions, entityId]);

  return (
    <div
      className={classNames(
        'flex h-[38px] justify-between hover:rounded hover:bg-accent-primary-alpha',
        entityRowClassNames,
      )}
      style={{
        paddingLeft: (level && `${level * 24 + 16}px`) || '0.875rem',
      }}
      data-qa={dataQA}
    >
      {children}
      {!!additionalItemData?.mappedActions && (
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
  containerClassNames?: string;
}
const FeatureContainer = ({
  children,
  containerClassNames,
}: FeatureContainerProps) => (
  <span
    className={classNames(
      'flex w-2/3 flex-row items-center gap-2',
      containerClassNames,
    )}
  >
    {children}
  </span>
);

interface ConversationViewProps {
  item: ConversationInfo;
  onSelect?: (ids: string[]) => void;
  isChosen?: boolean;
  featureContainerClassNames?: string;
}

const ConversationView = ({
  item: conversation,
  onSelect,
  isChosen,
  featureContainerClassNames,
}: ConversationViewProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <FeatureContainer containerClassNames={featureContainerClassNames}>
      {onSelect && (
        <div
          className="relative flex size-[18px] shrink-0"
          data-qa={isChosen ? 'selected' : null}
        >
          <input
            className="checkbox peer size-[18px] bg-layer-3"
            type="checkbox"
            checked={isChosen}
            data-qa={isChosen ? 'checked' : 'unchecked'}
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
      <ShareIcon
        featureType={FeatureType.Chat}
        isHighlighted={false}
        iconClassName="bg-layer-2"
        iconWrapperClassName="!bg-layer-2"
        {...conversation}
      >
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
      </ShareIcon>
      <Tooltip
        tooltip={conversation.name}
        contentClassName="max-w-[400px] break-all"
        triggerClassName={classNames(
          'truncate whitespace-pre',
          conversation.publicationInfo?.isNotExist && 'text-secondary',
          conversation.publicationInfo?.action === PublishActions.DELETE &&
            'text-error',
        )}
        dataQa="entity-name"
      >
        {conversation.name}
      </Tooltip>
    </FeatureContainer>
  );
};

export interface ConversationRowProps extends ConversationViewProps {
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: AdditionalItemData;
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
  featureContainerClassNames,
}: ConversationRowProps) => {
  return (
    <EntityRow
      entityId={conversation.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
      dataQA="conversation"
    >
      <ConversationView
        featureContainerClassNames={featureContainerClassNames}
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
  featureContainerClassNames?: string;
}

const PromptView = ({
  item: prompt,
  onSelect,
  isChosen,
  featureContainerClassNames,
}: PromptViewProps) => {
  return (
    <FeatureContainer containerClassNames={featureContainerClassNames}>
      {onSelect && (
        <div
          className="relative flex size-[18px] shrink-0"
          data-qa={isChosen ? 'selected' : null}
        >
          <input
            className="checkbox peer size-[18px] bg-layer-3"
            type="checkbox"
            checked={isChosen}
            data-qa={isChosen ? 'checked' : 'unchecked'}
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
        dataQa="entity-name"
      >
        {prompt.name}
      </Tooltip>
    </FeatureContainer>
  );
};

export interface PromptRowProps extends PromptViewProps {
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: AdditionalItemData;
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
      dataQA="prompt"
    >
      <PromptView isChosen={isChosen} onSelect={onSelect} item={prompt} />
    </EntityRow>
  );
};

interface FileViewProps {
  item: DialFile;
  onSelect?: (ids: string[]) => void;
  isChosen?: boolean;
  featureContainerClassNames?: string;
}

const FileView = ({
  item: file,
  onSelect,
  isChosen,
  featureContainerClassNames,
}: FileViewProps) => {
  return (
    <FeatureContainer containerClassNames={featureContainerClassNames}>
      {onSelect && (
        <div
          className="relative flex size-[18px] shrink-0"
          data-qa={isChosen ? 'selected' : null}
        >
          <input
            className="checkbox peer size-[18px] bg-layer-3"
            type="checkbox"
            checked={isChosen}
            data-qa={isChosen ? 'checked' : 'unchecked'}
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
        dataQa="entity-name"
      >
        {file.name}
      </Tooltip>
    </FeatureContainer>
  );
};

export interface FileRowProps extends FileViewProps {
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: AdditionalItemData;
  itemComponentClassNames?: string;
}

export const FilesRow = ({
  level,
  item,
  additionalItemData,
  onEvent,
  itemComponentClassNames,
  isChosen,
  featureContainerClassNames,
  onSelect,
}: FileRowProps) => {
  return (
    <EntityRow
      entityId={item.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
      dataQA="file"
    >
      <FileView
        featureContainerClassNames={featureContainerClassNames}
        onSelect={onSelect}
        isChosen={isChosen}
        item={item}
      />
    </EntityRow>
  );
};

interface ApplicationViewProps {
  item: ShareEntity;
  onSelect?: (ids: string[]) => void;
  isChosen?: boolean;
}

export interface ApplicationRowProps extends ApplicationViewProps {
  level?: number;
  onEvent?: (eventId: ReplaceOptions, data: string) => void;
  additionalItemData?: Record<string, unknown>;
  itemComponentClassNames?: string;
}

const ApplicationView = ({
  item: application,
  onSelect,
  isChosen,
}: ApplicationViewProps) => {
  const entity = {
    ...application,
    folderId: getFolderIdFromEntityId(application.name),
    type: EntityType.Application,
  };

  return (
    <FeatureContainer>
      {onSelect && (
        <div
          className="relative flex size-[18px] shrink-0"
          data-qa={isChosen ? 'selected' : null}
        >
          <input
            className="checkbox peer size-[18px] bg-layer-3"
            type="checkbox"
            checked={isChosen}
            data-qa={isChosen ? 'checked' : 'unchecked'}
            onChange={() => {
              onSelect([application.id]);
            }}
          />
          <IconCheck
            size={18}
            className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
          />
        </div>
      )}
      <span className="flex shrink-0">
        <ModelIcon entity={entity} entityId={application.id} size={18} />
      </span>
      <Tooltip
        tooltip={application.name}
        contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
        triggerClassName={classNames(
          'truncate whitespace-pre',
          application.publicationInfo?.isNotExist && 'text-secondary',
          application.publicationInfo?.action === PublishActions.DELETE &&
            'text-error',
        )}
        dataQa="entity-name"
      >
        {application.name}
      </Tooltip>
    </FeatureContainer>
  );
};

export const ApplicationRow = ({
  level,
  item: application,
  additionalItemData,
  onEvent,
  itemComponentClassNames,
  isChosen,
  onSelect,
}: ApplicationRowProps) => {
  return (
    <EntityRow
      entityId={application.id}
      level={level}
      additionalItemData={additionalItemData}
      onEvent={onEvent}
      entityRowClassNames={itemComponentClassNames}
      dataQA="application"
    >
      <ApplicationView
        isChosen={isChosen}
        onSelect={onSelect}
        item={application}
      />
    </EntityRow>
  );
};

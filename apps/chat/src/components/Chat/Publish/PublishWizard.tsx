import { IconHelpCircle } from '@tabler/icons-react';
import {
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { createTargetUrl } from '@/src/utils/app/publications';
import { getAttachments } from '@/src/utils/app/share';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { ApiKeys, ShareEntity } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { PublishActions, TargetAudienceFilter } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';
import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import Modal from '@/src/components/Common/Modal';
import Tooltip from '@/src/components/Common/Tooltip';

import {
  ConversationRow,
  PromptsRow,
} from '../../Common/ReplaceConfirmationModal/Components';
import {
  ConversationPublicationResources,
  FilePublicationResources,
  PromptPublicationResources,
} from './PublicationResources';
import { TargetAudienceFilterComponent } from './TargetAudienceFilter';

import capitalize from 'lodash-es/capitalize';
import compact from 'lodash-es/compact';
import flatMapDeep from 'lodash-es/flatMapDeep';

interface PublishModalFiltersProps {
  path: string;
  otherTargetAudienceFilters: TargetAudienceFilter[];
  onChangeFilters: (targetFilter: TargetAudienceFilter) => void;
}

function PublishModalFilters({
  path,
  otherTargetAudienceFilters,
  onChangeFilters,
}: PublishModalFiltersProps) {
  const { t } = useTranslation(Translation.Chat);

  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(state, `public/${path}/`),
  );
  const isRulesLoading = useAppSelector(
    PublicationSelectors.selectIsRulesLoading,
  );

  if (!path) {
    return (
      <p>
        {t(
          'This publication will be available to all users in the organization',
        )}
      </p>
    );
  }

  if (isRulesLoading) {
    return null; // loader for rules
  }

  if (rules) {
    return rules.map((rule, idx) => (
      <CollapsibleSection
        name={capitalize(rule.source)}
        dataQa={`filter-${rule.source}`}
        key={`filter-${idx}`}
        openByDefault
        className="!pl-0"
      >
        <TargetAudienceFilterComponent
          readonly
          name={rule.source}
          initialSelectedFilter={{
            filterFunction: rule.function,
            filterParams: rule.targets,
            id: rule.source,
            name: rule.source,
          }}
          id={rule.source}
          onChangeFilter={onChangeFilters}
        />
      </CollapsibleSection>
    ));
  }

  // define filters in config
  return [
    { id: 'title', name: 'Title' },
    { id: 'roles', name: 'Roles' },
  ].map((v, idx) => {
    const initialSelectedFilter = otherTargetAudienceFilters.find(
      ({ id }) => id === v.id,
    );
    return (
      <CollapsibleSection
        name={v.name}
        dataQa={`filter-${v.id}`}
        key={`filter-${idx}`}
        openByDefault={false}
        className="!pl-0"
      >
        <TargetAudienceFilterComponent
          name={v.name}
          id={v.id}
          initialSelectedFilter={initialSelectedFilter}
          onChangeFilter={onChangeFilters}
        />
      </CollapsibleSection>
    );
  });
}

interface Props {
  entity: ShareEntity;
  entities: ShareEntity[];
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
  depth?: number;
}

export function PublishModal({
  entity,
  isOpen,
  onClose,
  type,
  depth,
  entities,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const nameInputRef = useRef<HTMLInputElement>(null);

  const [path, setPath] = useState<string>('');
  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [otherTargetAudienceFilters, setOtherTargetAudienceFilters] = useState<
    TargetAudienceFilter[]
  >([]);

  const files = useAppSelector((state) =>
    getAttachments(type)(state, entity.id),
  );

  useEffect(() => {
    dispatch(PublicationActions.uploadRules({ path }));
  }, [dispatch, path]);

  const handleFolderChange = useCallback(() => {
    setIsChangeFolderModalOpened(true);
  }, []);

  const handleOnChangeFilters = (targetFilter: TargetAudienceFilter) => {
    setOtherTargetAudienceFilters((prev) => {
      const filters = prev
        .filter(({ id }) => id !== targetFilter.id)
        .concat(targetFilter);
      return filters;
    });
  };

  const handlePublish = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const trimmedPath = path.trim();
      const notEmptyFilters = otherTargetAudienceFilters.filter(
        (filter) => filter.filterParams.filter(Boolean).length,
      );

      if (
        type === SharingType.Conversation ||
        type === SharingType.ConversationFolder
      ) {
        const mappedFiles = (entities as Conversation[])
          .filter((c) => c.messages.some((m) => m.custom_content?.attachments))
          .flatMap((c) => {
            const urls = compact(
              flatMapDeep(c.messages, (m) =>
                m.custom_content?.attachments?.map((a) => a.url),
              ),
            );

            return urls.map((oldUrl) => ({
              oldUrl,
              newUrl: createTargetUrl(
                ApiKeys.Files,
                trimmedPath,
                constructPath(
                  ...c.id.split('/').slice(0, -1),
                  ...oldUrl.split('/').slice(-1),
                ),
                type,
              ),
            }));
          });

        dispatch(
          PublicationActions.publish({
            targetFolder: trimmedPath,
            resources: [
              ...entities.map((entity) => ({
                sourceUrl: entity.id,
                targetUrl: createTargetUrl(
                  ApiKeys.Conversations,
                  trimmedPath,
                  entity.id,
                  type,
                ),
              })),
              ...files.reduce<{ sourceUrl: string; targetUrl: string }[]>(
                (acc, file) => {
                  const item = mappedFiles.find((f) => f.oldUrl === file.id);

                  if (item) {
                    acc.push({
                      sourceUrl: file.id,
                      targetUrl: item.newUrl,
                    });
                  }

                  return acc;
                },
                [],
              ),
            ],
            rules: notEmptyFilters.map((filter) => ({
              function: filter.filterFunction,
              source: filter.id,
              targets: filter.filterParams,
            })),
          }),
        );
      } else {
        dispatch(
          PublicationActions.publish({
            resources: [
              ...entities.map((entity) => ({
                sourceUrl: entity.id,
                targetUrl: createTargetUrl(
                  ApiKeys.Prompts,
                  trimmedPath,
                  entity.id,
                  type,
                ),
              })),
            ],
            targetFolder: trimmedPath,
            rules: notEmptyFilters.map((filter) => ({
              function: filter.filterFunction,
              source: filter.id,
              targets: filter.filterParams,
            })),
          }),
        );
      }

      onClose();
    },
    [
      dispatch,
      entities,
      files,
      onClose,
      otherTargetAudienceFilters,
      path,
      type,
    ],
  );

  return (
    <Modal
      portalId="theme-main"
      containerClassName={classNames(
        'group/modal  inline-block h-[747px] min-w-full max-w-[1100px] !bg-layer-2 md:min-w-[550px] lg:min-w-[1000px] xl:w-[1100px]',
        { 'w-full': files.length },
      )}
      dataQa="publish-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      initialFocus={nameInputRef}
    >
      <div className="flex h-full flex-col divide-y divide-tertiary">
        <h4 className="p-4 pr-10 text-base font-semibold">
          <span className="line-clamp-2 whitespace-pre break-words text-center">
            {`${t('Publication request for')}: ${entity.name.trim()}`}
          </span>
        </h4>
        <div className="flex min-h-0 grow flex-col divide-y divide-tertiary overflow-y-auto md:flex-row md:divide-x md:divide-y-0">
          <div className="flex w-full shrink grow flex-col divide-y divide-tertiary md:max-w-[550px] md:overflow-y-auto">
            <section className="flex flex-col gap-3 px-5 py-4">
              <div>
                <label className="mb-4 flex text-sm" htmlFor="requestPath">
                  {t('Publish to')}
                </label>
                <button
                  className="input-form mx-0 flex grow items-center justify-between rounded border border-primary bg-transparent px-3 py-2 placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none"
                  onClick={handleFolderChange}
                >
                  <span className="truncate">
                    {constructPath(t(PUBLISHING_FOLDER_NAME), path)}
                  </span>
                  <span className="text-accent-primary">{t('Change')}</span>
                </button>
              </div>
            </section>

            <section className="flex flex-col px-5 py-4">
              <h2 className="mb-4 flex gap-2">
                {t('Target Audience Filters')}

                {path && (
                  <Tooltip
                    placement="top"
                    tooltip={
                      <div className="flex max-w-[230px] break-words text-xs">
                        {t(
                          'The collection will be published for all users who meet AT LEAST ONE option from every',
                        )}
                      </div>
                    }
                  >
                    <IconHelpCircle
                      size={18}
                      className="text-secondary  hover:text-accent-primary"
                    />
                  </Tooltip>
                )}
              </h2>

              <PublishModalFilters
                path={path}
                otherTargetAudienceFilters={otherTargetAudienceFilters}
                onChangeFilters={handleOnChangeFilters}
              />
            </section>
          </div>
          <div className="flex w-full flex-col gap-[2px] px-5 py-4 md:max-w-[550px]">
            {(type === SharingType.Conversation ||
              type === SharingType.ConversationFolder) && (
              <CollapsibleSection
                name={t('Conversations')}
                openByDefault
                dataQa="conversations-to-send-request"
              >
                {type === SharingType.Conversation ? (
                  <ConversationRow
                    itemComponentClassNames="cursor-pointer"
                    item={entity as ConversationInfo}
                    level={0}
                  />
                ) : (
                  <ConversationPublicationResources
                    rootFolder={entity}
                    resources={entities.map((entity) => ({
                      action: PublishActions.ADD,
                      sourceUrl: entity.id,
                      targetUrl: constructPath(
                        ApiKeys.Conversations,
                        'public',
                        path,
                        splitEntityId(entity.id).name,
                      ),
                      reviewUrl: entity.id,
                    }))}
                    forViewOnly
                  />
                )}
              </CollapsibleSection>
            )}
            {!!files.length && (
              <CollapsibleSection
                name={t('Files')}
                openByDefault
                dataQa="files-to-send-request"
              >
                <FilePublicationResources
                  uploadedFiles={files}
                  resources={files.map((f) => ({
                    action: PublishActions.ADD,
                    sourceUrl: f.id,
                    targetUrl: constructPath(
                      ApiKeys.Files,
                      'public',
                      path,
                      f.name,
                    ),
                    reviewUrl: f.id,
                  }))}
                  forViewOnly
                />
              </CollapsibleSection>
            )}
            {(type === SharingType.Prompt ||
              type === SharingType.PromptFolder) && (
              <CollapsibleSection
                name={t('Prompts')}
                openByDefault
                dataQa="prompts-to-send-request"
              >
                {type === SharingType.Prompt ? (
                  <PromptsRow
                    itemComponentClassNames="cursor-pointer"
                    item={entity}
                    level={0}
                  />
                ) : (
                  <PromptPublicationResources
                    rootFolder={entity}
                    resources={[
                      {
                        action: PublishActions.ADD,
                        sourceUrl: entity.id,
                        targetUrl: constructPath(
                          ApiKeys.Prompts,
                          'public',
                          path,
                          entity.name,
                        ),
                        reviewUrl: entity.id,
                      },
                    ]}
                    forViewOnly
                  />
                )}
              </CollapsibleSection>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4">
          <button
            className="button button-primary py-2"
            onClick={handlePublish}
            data-qa="publish"
            autoFocus
          >
            {t('Send request')}
          </button>
        </div>
      </div>
      <ChangePathDialog
        initiallySelectedFolderId={entity.id}
        isOpen={isChangeFolderModalOpened}
        onClose={(folderId) => {
          if (typeof folderId === 'string') {
            setPath(folderId);
          }

          setIsChangeFolderModalOpened(false);
        }}
        type={type}
        depth={depth}
        rootFolderId={
          type === SharingType.Conversation ||
          type === SharingType.ConversationFolder
            ? `${ApiKeys.Conversations}/public`
            : `${ApiKeys.Prompts}/public`
        }
      />
    </Modal>
  );
}

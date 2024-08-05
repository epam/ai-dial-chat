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
import { getRootId } from '@/src/utils/app/id';
import { createTargetUrl } from '@/src/utils/app/publications';
import { getAttachments } from '@/src/utils/app/share';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { FeatureType, ShareEntity } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { PublishActions, TargetAudienceFilter } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';
import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import Modal from '@/src/components/Common/Modal';
import Tooltip from '@/src/components/Common/Tooltip';

import HelpIcon from '../../../../public/images/icons/help.svg';
import { PublicationItemsList } from './PublicationItemsList';
import { TargetAudienceFilterComponent } from './TargetAudienceFilter';

import compact from 'lodash-es/compact';
import flatMapDeep from 'lodash-es/flatMapDeep';
import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

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
  const publicationFilters = useAppSelector(
    SettingsSelectors.selectPublicationFilters,
  );

  if (!path || (rules && !rules.length)) {
    return (
      <p>
        {t('chat.publish.the_publication_will_be_available_to_all_users.text')}
      </p>
    );
  }

  if (isRulesLoading) {
    return null; // TODO: loader for rules
  }

  if (rules) {
    return rules.map((rule, idx) => (
      <CollapsibleSection
        name={startCase(toLower(rule.source))}
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

  return publicationFilters.map((filter, idx) => {
    const initialSelectedFilter = otherTargetAudienceFilters.find(
      ({ id }) => id === filter,
    );

    return (
      <CollapsibleSection
        name={startCase(toLower(filter))}
        dataQa={`filter-${filter}`}
        key={`filter-${idx}`}
        openByDefault={false}
        className="!pl-0"
      >
        <TargetAudienceFilterComponent
          name={startCase(toLower(filter))}
          id={filter}
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

  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(state, `public/${path}/`),
  );
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
        (filter) =>
          filter.filterParams.filter((param) => Boolean(param.trim())).length,
      );
      const preparedFilters =
        rules && !notEmptyFilters.length
          ? rules.map((rule) => ({
              filterFunction: rule.function,
              filterParams: rule.targets,
              id: rule.source,
              name: rule.source,
            }))
          : otherTargetAudienceFilters;
      const folderRegExp = new RegExp(
        entity.folderId.split('/').slice(2).join('/'),
      );

      if (
        type === SharingType.Conversation ||
        type === SharingType.ConversationFolder
      ) {
        const mappedFiles = (entities as Conversation[])
          .filter((c) =>
            (c.playback?.messagesStack || c.messages).some(
              (m) => m.custom_content?.attachments,
            ),
          )
          .flatMap((c) => {
            const urls = compact(
              flatMapDeep(c.playback?.messagesStack || c.messages, (m) =>
                m.custom_content?.attachments?.map((a) => a.url),
              ),
            );

            return urls.map((oldUrl) => {
              const decodedOldUrl = ApiUtils.decodeApiUrl(oldUrl);

              return {
                oldUrl: decodedOldUrl,
                newUrl: createTargetUrl(
                  FeatureType.File,
                  trimmedPath,
                  constructPath(
                    ...c.id.split('/').slice(0, -1),
                    ...decodedOldUrl.split('/').slice(-1),
                  ).replace(folderRegExp, ''),
                  type,
                ),
              };
            });
          });

        dispatch(
          PublicationActions.publish({
            targetFolder: trimmedPath,
            resources: [
              ...entities.map((item) => ({
                sourceUrl: item.id,
                targetUrl: createTargetUrl(
                  FeatureType.Chat,
                  trimmedPath,
                  type === SharingType.ConversationFolder
                    ? item.id.replace(folderRegExp, '')
                    : item.id,
                  type,
                ),
              })),
              ...files.reduce<{ sourceUrl: string; targetUrl: string }[]>(
                (acc, file) => {
                  const decodedFileId = ApiUtils.decodeApiUrl(file.id);
                  const item = mappedFiles.find(
                    (f) => f.oldUrl === decodedFileId,
                  );

                  if (item) {
                    acc.push({
                      sourceUrl: decodedFileId,
                      targetUrl: item.newUrl,
                    });
                  }

                  return acc;
                },
                [],
              ),
            ],
            rules: preparedFilters.map((filter) => ({
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
              ...entities.map((item) => ({
                sourceUrl: item.id,
                targetUrl: createTargetUrl(
                  FeatureType.Prompt,
                  trimmedPath,
                  type === SharingType.PromptFolder
                    ? item.id.replace(folderRegExp, '')
                    : item.id,
                  type,
                ),
              })),
            ],
            targetFolder: trimmedPath,
            rules: preparedFilters.map((filter) => ({
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
      entity.folderId,
      files,
      onClose,
      otherTargetAudienceFilters,
      path,
      rules,
      type,
    ],
  );

  return (
    <Modal
      portalId="theme-main"
      containerClassName={classNames(
        'publish-wizard-modal group/modal  inline-block h-[747px] min-w-full max-w-[1100px] !bg-layer-2 md:min-w-[550px] lg:min-w-[1000px] xl:w-[1100px]',
        { 'w-full': files.length },
      )}
      dataQa="publish-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      initialFocus={nameInputRef}
    >
      <div className="flex h-full flex-col divide-y divide-secondary rounded-[10px] bg-layer-1">
        <h4 className="truncate p-4 pr-10 text-xl font-medium text-primary-bg-light">
          <span className="w-full text-center">
            <Tooltip
              contentClassName="max-w-[400px] break-words"
              tooltip={entity.name.trim()}
            >
              <div
                className="w-full truncate break-words"
                data-qa="modal-entity-name"
              >
                {t('chat.publish.publication_request_for_entity.label', {
                  name: entity.name.trim(),
                })}
              </div>
            </Tooltip>
          </span>
        </h4>
        <div className="flex min-h-0 grow flex-col divide-y divide-secondary overflow-y-auto md:flex-row md:divide-x md:divide-y-0">
          <div className="flex w-full shrink grow flex-col divide-y divide-secondary md:max-w-[550px] md:overflow-y-auto">
            <section className="flex flex-col gap-3 px-5 py-4">
              <div>
                <label className="mb-4 flex text-sm" htmlFor="requestPath">
                  {t('chat.publish.publish_to.label')}
                </label>
                <button
                  className="input-form mx-0 flex grow items-center justify-between rounded-primary border border-secondary bg-layer-2 px-3 py-2 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary"
                  onClick={handleFolderChange}
                >
                  <div className="flex w-full justify-between truncate whitespace-pre break-all">
                    <Tooltip
                      tooltip={constructPath(PUBLISHING_FOLDER_NAME, path)}
                      contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
                      triggerClassName="truncate whitespace-pre"
                    >
                      {constructPath(PUBLISHING_FOLDER_NAME, path)}
                    </Tooltip>
                    <span className="text-tertiary-bg-light">
                      {t('chat.publish.button.change.label')}
                    </span>
                  </div>
                </button>
              </div>
            </section>

            <section className="flex flex-col px-5 py-4">
              <h2 className="mb-4 flex gap-2 font-medium">
                {t('chat.publish.target_audience_filters.label')}

                {!!(path && rules && rules.length) && (
                  <Tooltip
                    placement="top"
                    tooltip={
                      <div className="flex max-w-[230px] break-words text-xs">
                        {t(
                          'chat.publish.the_collections_will_be_published.text',
                        )}
                      </div>
                    }
                  >
                    <HelpIcon width={18} height={18} />
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
          <PublicationItemsList
            type={type}
            entity={entity}
            entities={entities}
            path={path}
            files={files}
            containerClassNames="px-5 py-4"
            publishAction={PublishActions.ADD}
          />
        </div>

        <div className="flex justify-end gap-3 p-4">
          <button
            className="button button-primary button-medium py-2"
            onClick={handlePublish}
            data-qa="publish"
            autoFocus
          >
            {t('chat.publish.button.send_request.label')}
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
            ? getRootId({ featureType: FeatureType.Chat, bucket: 'public' })
            : getRootId({ featureType: FeatureType.Prompt, bucket: 'public' })
        }
      />
    </Modal>
  );
}

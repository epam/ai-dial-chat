import { IconHelpCircle } from '@tabler/icons-react';
import {
  ChangeEvent,
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  constructPath,
  validatePublishingFileRenaming,
} from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import {
  getConversationRootId,
  getFileRootId,
  getPromptRootId,
} from '@/src/utils/app/id';
import { getAttachments } from '@/src/utils/app/share';
import { onBlur } from '@/src/utils/app/style-helpers';
import { parseConversationApiKey } from '@/src/utils/server/api';

import { ShareEntity } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { TargetAudienceFilter } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';

import CollapsibleSection from '../../Common/CollapsibleSection';
import EmptyRequiredInputMessage from '../../Common/EmptyRequiredInputMessage';
import { ErrorMessage } from '../../Common/ErrorMessage';
import Modal from '../../Common/Modal';
import Tooltip from '../../Common/Tooltip';
import { PublishAttachment } from './PublishAttachment';
import { TargetAudienceFilterComponent } from './TargetAudienceFilter';

interface Props {
  entity: ShareEntity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
  depth?: number;
}

const getPrefix = (item: ShareEntity): string => {
  if ('messages' in item) {
    return 'Conversation';
  } else if ('description' in item) {
    return 'Prompt';
  } else {
    return 'Collection';
  }
};

export default function PublishWizard({
  entity,
  isOpen,
  onClose,
  type,
  depth,
}: Props) {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState<string>(entity.name);
  const [path, setPath] = useState<string>('');
  const [renamingFile, setRenamingFile] = useState<DialFile>();
  const newFileNames = useRef(new Map());
  const [errorMessage, setErrorMessage] = useState('');

  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  // const [version, setVersion] = useState<string>('');
  // const isVersionUnique = useAppSelector((state) =>
  // isPublishVersionUnique(type)(state, entity.id, version.trim()),
  // );

  const files = useAppSelector((state) =>
    getAttachments(type)(state, entity.id),
  );
  // const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [otherTargetAudienceFilters, setOtherTargetAudienceFilters] = useState<
    TargetAudienceFilter[]
  >([]);

  const nameOnChangeHandler = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
    },
    [],
  );

  // const versionOnChangeHandler = useCallback(
  //   (e: ChangeEvent<HTMLInputElement>) => {
  //     setVersion(e.target.value);
  //   },
  //   [],
  // );

  const handleStartFileRename = useCallback((file: DialFile) => {
    setRenamingFile(file);
  }, []);

  const handleFileRename = useCallback(
    (name: string, cancel?: boolean) => {
      if (cancel || !renamingFile) {
        setErrorMessage('');
        setRenamingFile(undefined);
        return;
      }

      const error = validatePublishingFileRenaming(files, name, renamingFile);
      if (error) {
        setErrorMessage(t(error) as string);
        return;
      } else setErrorMessage('');

      const nameMap = newFileNames.current;
      let oldPath = constructPath(renamingFile.relativePath, renamingFile.name);
      const newPath = constructPath(renamingFile.relativePath, name);
      if (nameMap.has(oldPath)) {
        const originalPath = nameMap.get(oldPath);
        nameMap.delete(oldPath);
        oldPath = originalPath;
      }
      newFileNames.current.set(newPath, oldPath);
      renamingFile.name = name;
      setRenamingFile(undefined);
    },
    [files, renamingFile, t],
  );

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

      setSubmitted(true);

      const trimmedName = name?.trim();
      // const trimmedVersion = version?.trim();
      const trimmedPath = path?.trim();

      if (!trimmedName) {
        return;
      }

      // if (!isVersionUnique) return;

      dispatch(
        PublicationActions.publish({
          sourceUrl: entity.id,
          targetFolder: trimmedPath + '/',
          targetUrl: `${entity.id.split('/')[0]}/public/${trimmedPath ? `${trimmedPath}/` : ''}${
            parseConversationApiKey(splitEntityId(entity.id).name).model.id +
            '__' +
            trimmedName
          }`,
          rules: otherTargetAudienceFilters.map((filter) => ({
            function: filter.filterFunction,
            source: filter.id,
            targets: filter.filterParams,
          })),
        }),
      );
      onClose();
    },
    [dispatch, entity.id, name, onClose, otherTargetAudienceFilters, path],
  );

  // const handleBlur = useCallback(() => {
  //   setSubmitted(true);
  // }, []);

  const inputClassName = classNames('input-form mx-0 py-2', 'peer', {
    'input-invalid submitted': submitted,
  });

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
          <span className="line-clamp-2 whitespace-pre break-words">
            {`${t('Publication request for')}: ${entity.name.trim()}`}
          </span>
        </h4>
        <div className="flex min-h-0 grow flex-col divide-y divide-tertiary overflow-y-auto md:flex-row md:divide-x md:divide-y-0">
          <div className="flex w-full shrink grow flex-col divide-y divide-tertiary md:max-w-[550px] md:overflow-y-auto">
            <section className="flex flex-col gap-3 px-5 py-4">
              <h2>{t('General Info')}</h2>
              <p className="text-secondary">
                {t(
                  'Your conversation will be visible to organization only after verification by the administrator',
                )}
              </p>

              <div>
                <label
                  className="mb-1 flex text-xs text-secondary"
                  htmlFor="requestName"
                >
                  {t(`${getPrefix(entity)} name`)}
                  <span className="ml-1 inline text-accent-primary">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  name="requestName"
                  className={inputClassName}
                  placeholder={t('A name for your request.') || ''}
                  value={name}
                  required
                  type="text"
                  onBlur={onBlur}
                  onChange={nameOnChangeHandler}
                  data-qa="request-name"
                />
                <EmptyRequiredInputMessage useDisplay className="!mb-0" />
              </div>

              <div>
                <label
                  className="mb-1 flex text-xs text-secondary"
                  htmlFor="requestPath"
                >
                  {t('Path')}
                  <span className="ml-1 inline text-accent-primary">*</span>
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

              {/* <div>
                <label
                  className="mb-1 flex text-xs text-secondary"
                  htmlFor="requestVersion"
                >
                  {t('Version')}
                  <span className="ml-1 inline text-accent-primary">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  name="requestVersion"
                  className={classNames(inputClassName, {
                    '!border-error': !isVersionUnique && submitted,
                  })}
                  placeholder={t('A version for your request.') || ''}
                  value={version}
                  required
                  type="text"
                  data-qa="request-version"
                  onBlur={handleBlur}
                  onChange={versionOnChangeHandler}
                />
                {submitted && (!isVersionUnique || !version.trim()) && (
                  <div className="text-xxs text-error">
                    {t(
                      !isVersionUnique
                        ? 'Please provide unique version'
                        : 'Please fill in all required fields',
                    )}
                  </div>
                )}
              </div> */}
            </section>

            <section className="flex flex-col px-5 py-4">
              <h2 className="flex flex-row gap-2">
                {t('Target Audience Filters')}

                <Tooltip
                  placement="top"
                  tooltip={
                    <div className="max-w-[230px] break-words text-xs">
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
              </h2>

              {/* <CollapsableSection
                name={t('User Group')}
                dataQa="filter-user-group"
                openByDefault={false}
                className="!pl-0"
              >
                <UserGroupFilter
                  onChangeUserGroups={setUserGroups}
                  initialSelectedUserGroups={userGroups}
                />
              </CollapsableSection> */}

              {[
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
                    key={`filter-${v.id}-${idx}`}
                    openByDefault={false}
                    className="!pl-0"
                  >
                    <TargetAudienceFilterComponent
                      name={v.name}
                      id={v.id}
                      initialSelectedFilter={initialSelectedFilter}
                      onChangeFilter={handleOnChangeFilters}
                    />
                  </CollapsibleSection>
                );
              })}
            </section>
          </div>
          {(type === SharingType.Conversation ||
            type === SharingType.ConversationFolder) && (
            <div className="flex w-full flex-col gap-[2px] px-5 py-4 md:max-w-[550px]">
              <h2 className="mb-2">
                {t(`Files contained in the ${getPrefix(entity).toLowerCase()}`)}
              </h2>
              <ErrorMessage error={errorMessage} />
              {!files.length && (
                <p className="text-secondary">{t('No files')}</p>
              )}
              {files.map((file) => (
                <PublishAttachment
                  key={constructPath(file?.relativePath, file?.name)}
                  isRenaming={file === renamingFile}
                  file={file}
                  onRename={handleFileRename}
                  onStartRename={handleStartFileRename}
                />
              ))}
            </div>
          )}
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
          type === SharingType.Conversation
            ? getConversationRootId()
            : type === SharingType.Prompt
              ? getPromptRootId()
              : getFileRootId()
        }
      />
    </Modal>
  );
}

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
import {
  getAttachments,
  getPublishActionByType,
  isPublishVersionUnique,
} from '@/src/utils/app/share';
import { onBlur } from '@/src/utils/app/style-helpers';

import { ShareEntity } from '@/src/types/common';
import { PublishAttachmentInfo, SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';

import CollapsableSection from '../Common/CollapsableSection';
import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';
import { ErrorMessage } from '../Common/ErrorMessage';
import Modal from '../Common/Modal';
import { PublishAttachment } from './PublishAttachment';

import { v4 as uuidv4 } from 'uuid';

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

export default function PublishModal({
  entity,
  isOpen,
  onClose,
  type,
  depth,
}: Props) {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const publishAction = getPublishActionByType(type);
  const shareId = useRef(uuidv4());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState<string>(entity.name);
  const [path, setPath] = useState<string>('');
  const [renamingFile, setRenamingFile] = useState<PublishAttachmentInfo>();
  const newFileNames = useRef(new Map());
  const [errorMessage, setErrorMessage] = useState('');

  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [version, setVersion] = useState<string>('');

  const isVersionUnique = useAppSelector((state) =>
    isPublishVersionUnique(type)(state, entity.id, version.trim()),
  );

  const files = useAppSelector((state) =>
    getAttachments(type)(state, entity.id),
  );

  const nameOnChangeHandler = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
    },
    [],
  );

  const versionOnChangeHandler = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setVersion(e.target.value);
    },
    [],
  );

  const handleStartFileRename = useCallback((file: PublishAttachmentInfo) => {
    setRenamingFile(file);
  }, []);

  const handleFileRename = useCallback(
    (file: PublishAttachmentInfo, name: string) => {
      const error = validatePublishingFileRenaming(files, name, file);
      if (error) {
        setErrorMessage(t(error) as string);
        return;
      } else setErrorMessage('');

      const nameMap = newFileNames.current;
      let oldPath = constructPath(file.path, file.name);
      const newPath = constructPath(file.path, name);
      if (nameMap.has(oldPath)) {
        const originalPath = nameMap.get(oldPath);
        nameMap.delete(oldPath);
        oldPath = originalPath;
      }
      newFileNames.current.set(newPath, oldPath);
      file.name = name;
      setRenamingFile(undefined);
    },
    [],
  );

  const handleFolderChange = useCallback(() => {
    setIsChangeFolderModalOpened(true);
  }, []);

  const handleClose = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setSubmitted(false);
      onClose();
    },
    [onClose],
  );

  const handlePublish = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setSubmitted(true);

      const trimmedName = name?.trim();
      const trimmedVersion = version?.trim();
      const trimmedPath = path?.trim();

      if (!trimmedName || !trimmedVersion) {
        return;
      }

      if (!isVersionUnique) return;

      dispatch(
        publishAction({
          id: entity.id,
          shareUniqueId: shareId.current,
          name: trimmedName,
          path: trimmedPath,
          version: trimmedVersion,
          fileNameMapping: newFileNames.current,
        }),
      );
      onClose();
    },
    [
      dispatch,
      entity.id,
      isVersionUnique,
      name,
      onClose,
      path,
      publishAction,
      version,
    ],
  );

  const handleBlur = useCallback(() => {
    setSubmitted(true);
  }, []);

  const inputClassName = classNames('input-form py-2', 'peer', {
    'input-invalid submitted': submitted,
  });

  return (
    <Modal
      portalId="theme-main"
      containerClassName={classNames(
        'group/modal inline-block h-[747px] max-h-full min-w-full max-w-[1100px] !bg-layer-2 md:min-w-[550px]',
        { 'w-full': files.length },
      )}
      dataQa="publish-modal"
      isOpen={isOpen}
      onClose={onClose}
      initialFocus={nameInputRef}
      hideClose
    >
      <div className="flex h-full flex-col divide-y divide-tertiary">
        <h4 className="p-4 text-base font-semibold">
          <span className="line-clamp-2 break-words">
            {`${t('Publication request for')}: ${entity.name.trim()}`}
          </span>
        </h4>
        <div className="flex min-h-0 grow flex-col divide-y divide-tertiary overflow-y-auto md:flex-row md:divide-x md:divide-y-0">
          <div className="flex w-full shrink grow flex-col divide-y divide-tertiary md:max-w-[550px] md:overflow-y-auto">
            <section className="flex flex-col gap-3 p-4">
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
                  className="input-form flex grow items-center justify-between rounded border border-primary bg-transparent px-3 py-2 placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none"
                  onClick={handleFolderChange}
                >
                  <span className="truncate">
                    {constructPath(t(PUBLISHING_FOLDER_NAME), path)}
                  </span>
                  <span className="text-accent-primary">{t('Change')}</span>
                </button>
              </div>

              <div>
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
              </div>
            </section>

            <section className="flex flex-col p-4">
              <h2>{t('Target Audience Filters')}</h2>

              {[
                'UserGroup',
                'JobTitle',
                'AssignedProjects',
                'UserGroup',
                'JobTitle',
                'AssignedProjects',
              ].map((v, idx) => (
                <CollapsableSection
                  name={v}
                  dataQa={`filter-${v}`}
                  key={`filter-${v}-${idx}`}
                  openByDefault={false}
                  className="!pl-0"
                >
                  TBD
                </CollapsableSection>
              ))}
            </section>
          </div>
          {(type === SharingType.Conversation ||
            type === SharingType.ConversationFolder) && (
            <div className="flex w-full flex-col gap-[2px] p-4 md:max-w-[550px]">
              <h2 className="mb-2">
                {t(`Files contained in the ${getPrefix(entity).toLowerCase()}`)}
              </h2>
              <ErrorMessage error={errorMessage} />
              {!files.length && (
                <p className="text-secondary">{t('No files')}</p>
              )}
              {files.map((file) => (
                <PublishAttachment
                  key={constructPath(file?.path, file?.name)}
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
            className="button button-secondary py-2"
            onClick={handleClose}
            data-qa="cancel"
          >
            {t('Cancel')}
          </button>
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
      />
    </Modal>
  );
}

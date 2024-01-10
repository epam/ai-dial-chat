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

import { constructPath } from '@/src/utils/app/file';
import {
  getPublishActionByType,
  isPublishVersionUnique,
} from '@/src/utils/app/share';
import { onBlur } from '@/src/utils/app/style-helpers';

import { ShareEntity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';

import CollapsableSection from '../Common/CollapsableSection';
import EmptyRequiredInputMessage from '../Common/EmptyRequiredInputMessage';
import Modal from '../Common/Modal';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  entity: ShareEntity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
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

export default function PublishModal({ entity, isOpen, onClose, type }: Props) {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const publishAction = getPublishActionByType(type);
  const shareId = useRef(uuidv4());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState<string>(entity.name);
  const [path, setPath] = useState<string>('');
  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [version, setVersion] = useState<string>('');

  const isVersionUnique = useAppSelector((state) =>
    isPublishVersionUnique(type)(state, entity.id, version.trim()),
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
      containerClassName="inline-block h-[747px] min-w-[550px] max-w-[1100px] p-6 group/modal"
      dataQa="publish-modal"
      isOpen={isOpen}
      onClose={onClose}
      initialFocus={nameInputRef}
    >
      <div className="flex h-full flex-col gap-2">
        <h4 className=" max-h-[50px] text-base font-semibold">
          <span className="line-clamp-2 break-words">
            {`${t('Publication request for')}: ${entity.name.trim()}`}
          </span>
        </h4>

        <section className="flex grow flex-col gap-3">
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
                {constructPath(t('Organization'), path)}
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
              <div className="mb-4 text-xxs text-error">
                {t(
                  !isVersionUnique
                    ? 'Please provide unique version'
                    : 'Please fill in all required fields',
                )}
              </div>
            )}
          </div>
        </section>

        <section className="flex grow flex-col gap-3">
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
              className="pl-0"
            >
              TBD
            </CollapsableSection>
          ))}
        </section>

        <div className="flex justify-end gap-3">
          <button
            className="button button-secondary"
            onClick={handleClose}
            data-qa="cancel"
          >
            {t('Cancel')}
          </button>
          <button
            className="button button-primary"
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
      />
    </Modal>
  );
}

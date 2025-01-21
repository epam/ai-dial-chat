import { IconCheck, IconCopy } from '@tabler/icons-react';
import {
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { constructPath } from '@/src/utils/app/file';
import { getShareType } from '@/src/utils/app/share';

import { FeatureType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions, ShareSelectors } from '@/src/store/share/share.reducers';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import Modal from '../Common/Modal';
import Tooltip from '../Common/Tooltip';

import { SharePermission } from '@epam/ai-dial-shared';

export const ShareModal = () => {
  const isShareModalClosed = useAppSelector(
    ShareSelectors.selectShareModalClosed,
  );
  if (!isShareModalClosed) {
    return <ShareModalView />;
  }
};

interface ShareAccessOptionProps {
  filterValue: string;
  selected: boolean;
  onSelect: (value: boolean) => void;
}

const ShareAccessOption = ({
  filterValue,
  selected,
  onSelect,
}: ShareAccessOptionProps) => {
  return (
    <label
      className="relative flex size-[18px] w-full shrink-0 cursor-pointer items-center"
      data-qa="share-option"
    >
      <input
        className="checkbox peer size-[18px] bg-layer-3"
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
      />
      <IconCheck
        size={18}
        className="invisible absolute text-accent-primary peer-checked:visible"
      />
      <span className="ml-2 whitespace-nowrap text-sm">{filterValue}</span>
    </label>
  );
};

export default function ShareModalView() {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();

  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [urlWasCopied, setUrlWasCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [editAccess, setEditAccess] = useState(false);
  const modalState = useAppSelector(ShareSelectors.selectShareModalState);
  const readInvitationId = useAppSelector(ShareSelectors.selectInvitationId);
  const writeInvitationId = useAppSelector(
    ShareSelectors.selectWriteInvitationId,
  );
  const invitationId = editAccess ? writeInvitationId : readInvitationId;

  const shareResourceId = useAppSelector(ShareSelectors.selectShareResourceId);

  const shareResourceName = useAppSelector(
    ShareSelectors.selectShareResourceName,
  );
  const shareResourceVersion = useAppSelector(
    ShareSelectors.selectShareResourceVersion,
  );
  const shareFeatureType = useAppSelector(
    ShareSelectors.selectShareFeatureType,
  );
  const isFolder = useAppSelector(ShareSelectors.selectShareIsFolder);

  const sharingType = useMemo(() => {
    return getShareType(shareFeatureType, isFolder);
  }, [shareFeatureType, isFolder]);
  const [url, setUrl] = useState('');

  const onChangeSharePermissionHandler = useCallback(
    (isWrite: boolean) => {
      setEditAccess(isWrite);
      const shouldGetNewInvitationId =
        (isWrite && !writeInvitationId) || (!isWrite && !readInvitationId);

      if (shareResourceId && shouldGetNewInvitationId) {
        dispatch(
          ShareActions.shareApplication({
            resourceId: shareResourceId,
            permissions: isWrite
              ? [SharePermission.READ, SharePermission.WRITE]
              : [SharePermission.READ],
          }),
        );
      }
    },
    [dispatch, readInvitationId, shareResourceId, writeInvitationId],
  );

  useEffect(() => {
    setUrl(
      constructPath(
        window?.location.origin,
        shareFeatureType === FeatureType.Application
          ? 'marketplace'
          : undefined,
        'share',
        invitationId,
      ),
    );
  }, [invitationId, shareFeatureType]);

  const handleClose = useCallback(() => {
    dispatch(ShareActions.setModalState({ modalState: ModalState.CLOSED }));
  }, [dispatch]);

  const handleCopy = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(url).then(() => {
        setUrlCopied(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setUrlCopied(false);
        }, 2000);
        if (!urlWasCopied) {
          setUrlWasCopied(true);
        }
      });
    },
    [url, urlWasCopied],
  );

  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block w-full max-w-[424px] px-3 py-4 md:p-6"
      dataQa="share-modal"
      state={modalState}
      onClose={handleClose}
      heading={`${t('Share')}: ${shareResourceName?.trim()}`}
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
    >
      <div className="flex flex-col justify-between gap-2">
        {shareResourceVersion && <span>Version: {shareResourceVersion}</span>}
        <p className="text-sm text-secondary">
          {t('share.modal.link.description')}
        </p>
        <p className="text-sm text-secondary">
          {t('share.modal.link', { context: sharingType })}
        </p>
        {shareFeatureType === FeatureType.Application && (
          <div className="my-2 flex flex-col gap-2">
            <ShareAccessOption
              filterValue="Allow editing by other users"
              selected={editAccess}
              onSelect={onChangeSharePermissionHandler}
            />
          </div>
        )}
        <div className="relative mt-2">
          <Tooltip tooltip={url}>
            <input
              type="text"
              readOnly
              className="w-full gap-2 truncate rounded border border-primary bg-layer-3 p-3 pr-10 outline-none"
              onCopyCapture={handleCopy}
              value={url}
              data-qa="share-link"
            />
          </Tooltip>
          <div className="absolute right-3 top-3">
            {urlCopied ? (
              <Tooltip tooltip={t('Copied!')}>
                <IconCheck size={20} className="text-secondary" />
              </Tooltip>
            ) : (
              <Tooltip tooltip={t('Copy URL')}>
                <button
                  className="outline-none"
                  onClick={handleCopy}
                  ref={copyButtonRef}
                  data-qa="copy-link"
                >
                  <IconCopy
                    height={20}
                    width={20}
                    className="text-secondary hover:text-accent-primary"
                  />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

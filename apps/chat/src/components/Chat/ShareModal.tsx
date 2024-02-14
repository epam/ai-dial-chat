import { IconCheck, IconCopy } from '@tabler/icons-react';
import {
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions, ShareSelectors } from '@/src/store/share/share.reducers';

import Modal from '../Common/Modal';
import Tooltip from '../Common/Tooltip';

export default function ShareModal() {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();

  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [urlWasCopied, setUrlWasCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const modalState = useAppSelector(ShareSelectors.selectShareModalState);
  const invitationId = useAppSelector(ShareSelectors.selectInvitationId);
  const shareResourceName = useAppSelector(
    ShareSelectors.selectShareResourceName,
  );
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(`${window?.location.origin}/share/${invitationId || ''}`);
  }, [invitationId]);

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
      containerClassName="inline-block w-full max-w-[424px] p-6"
      dataQa="share-modal"
      state={modalState}
      onClose={handleClose}
      heading={`${t('Share')}: ${shareResourceName?.trim()}`}
    >
      <div className="flex flex-col justify-between gap-2">
        <p className="text-sm text-secondary">
          {t('share.modal.link.description')}
        </p>
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

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

import { getShareActionByType } from '@/src/utils/app/share';

import { ShareEntity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';

import Modal from '../Common/Modal';
import Tooltip from '../Common/Tooltip';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  entity: ShareEntity;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ entity, isOpen, onClose, type }: Props) {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const shareAction = getShareActionByType(type);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [urlWasCopied, setUrlWasCopied] = useState(false);
  const shareId = useRef(uuidv4());
  const url = `${window?.location.origin}/share/${shareId.current}`;
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

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
          dispatch(
            shareAction({ id: entity.id, shareUniqueId: shareId.current }),
          );
        }
      });
    },
    [dispatch, entity.id, shareAction, url, urlWasCopied],
  );

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="inline-block w-full max-w-[424px] p-6"
      dataQA="share-modal"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="flex flex-col justify-between gap-2">
        <h4 className=" max-h-[50px] text-base font-semibold">
          <Tooltip tooltip={entity.name.trim()}>
            <span
              className="line-clamp-2 break-words"
              data-qa="share-chat-name"
            >
              {`${t('Share')}: ${entity.name.trim()}`}
            </span>
          </Tooltip>
        </h4>
        <p className="text-sm text-secondary">
          {t('share.modal.link.description')}
        </p>
        <p className="text-sm text-secondary">
          {t('share.modal.link', { context: type })}
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

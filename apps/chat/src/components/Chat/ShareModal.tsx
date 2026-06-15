import { IconCheck, IconCopy } from '@tabler/icons-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useRouter } from 'next/router';

import { useCopy } from '@/src/hooks/useCopy';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isQuickApp2 } from '@/src/utils/app/application';
import { translateConversationDisplayName } from '@/src/utils/app/translateConversationDisplayName';
import { constructPath } from '@/src/utils/app/file';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { getShareType } from '@/src/utils/app/share';

import { FeatureType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { QuickApp2Config } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { ApplicationActions, ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  ShareSelectors,
} from '@/src/store/selectors';

import { SideBarI18nKeys, ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';

import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { Tooltip } from '@/src/components/Common/Tooltip';

import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { SharePermission } from '@epam/ai-dial-shared';
import {
  DialEllipsisTooltip,
  DialGhostIconButton,
  DialLinkButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';

interface ShareAccessOptionProps {
  filterValue: string;
  selected: boolean;
  onSelect: (value: boolean) => void;
}

function ShareAccessOption({
  filterValue,
  selected,
  onSelect,
}: ShareAccessOptionProps) {
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
      <span className="ms-2 whitespace-nowrap text-sm">{filterValue}</span>
    </label>
  );
}

function ShareAccessSection({
  isShared,
  onUnshare,
  notSharedMessage,
  unshareLabel,
}: {
  isShared: boolean;
  onUnshare: () => void;
  notSharedMessage: string;
  unshareLabel: string;
}) {
  return (
    <div className="divide-y-0 border-t border-tertiary px-3 py-4 text-sm text-secondary md:p-6">
      {isShared ? (
        <DialLinkButton
          onClick={onUnshare}
          data-qa="remove-access-button"
          iconBefore={<IconUserUnshare height={18} width={18} />}
          label={unshareLabel}
        />
      ) : (
        <p data-qa="not-shared-entity-label">{notSharedMessage}</p>
      )}
    </div>
  );
}

function ShareModalView() {
  const router = useRouter();
  const { t } = useTranslation(Translation.SideBar);
  const { t: tChat } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const [editAccess, setEditAccess] = useState(false);

  const modalState = useAppSelector(ShareSelectors.selectShareModalState);
  const readInvitationId = useAppSelector(ShareSelectors.selectInvitationId);
  const writeInvitationId = useAppSelector(
    ShareSelectors.selectWriteInvitationId,
  );
  const shareResourceId = useAppSelector(ShareSelectors.selectShareResourceId);
  const shareResourceName = useAppSelector(
    ShareSelectors.selectShareResourceName,
  );
  const isResourceShared = useAppSelector(
    ShareSelectors.selectIsResourceShared,
  );
  const shareFeatureType = useAppSelector(
    ShareSelectors.selectShareFeatureType,
  );
  const entity = useAppSelector((state) =>
    ModelsSelectors.selectModelById(state, shareResourceId),
  );
  const applicationDetail = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const isFolder = useAppSelector(ShareSelectors.selectShareIsFolder);

  const invitationId = editAccess ? writeInvitationId : readInvitationId;
  const sharingType = useMemo(() => {
    return getShareType(shareFeatureType, isFolder);
  }, [shareFeatureType, isFolder]);

  useEffect(() => {
    if (entity && isQuickApp2(entity) && shareResourceId) {
      dispatch(ApplicationActions.get({ applicationId: shareResourceId }));
    }
  }, [shareResourceId, entity, dispatch]);

  const hasPrivateSkills = useMemo(() => {
    if (!entity || !isQuickApp2(entity)) return false;
    const config = applicationDetail?.applicationProperties as
      | QuickApp2Config
      | undefined;
    return (config?.skills ?? []).some((s) => !isEntityIdPublic({ id: s.url }));
  }, [entity, applicationDetail]);

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

  const { copied: urlCopied, onCopy } = useCopy(url);

  const handleCopy = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onCopy();
    },
    [onCopy],
  );

  const handleOpenUnshare = useCallback(() => {
    handleClose();
    dispatch(ShareActions.setUnshareEntity(entity));
  }, [dispatch, entity, handleClose]);

  const handleOpenUnshareResource = useCallback(() => {
    handleClose();
    dispatch(ShareActions.setUnshareResourceId(shareResourceId));
  }, [dispatch, handleClose, shareResourceId]);

  const displayResourceName = useMemo(() => {
    const name = shareResourceName?.trim();
    if (!name) {
      return name;
    }

    if (shareFeatureType === FeatureType.Chat) {
      return translateConversationDisplayName(name, router.locale, tChat);
    }

    return name;
  }, [router.locale, shareFeatureType, shareResourceName, tChat]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="flex flex-col w-full max-w-[424px]"
      dataQa="share-modal"
      state={modalState}
      onClose={handleClose}
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
    >
      <div className="flex min-h-0 flex-1 flex-col px-3 py-4 md:p-6">
        <h4 className="mb-2 max-h-[50px] whitespace-pre-wrap text-start text-base font-semibold">
          <div
            className="flex w-full items-center gap-2 pe-6"
            data-qa="modal-entity-name"
          >
            <p>{t(SideBarI18nKeys.Share)}:</p>
            <DialEllipsisTooltip text={displayResourceName} />
          </div>
        </h4>

        <div className="flex flex-col justify-between gap-2 overflow-auto">
          {entity?.version && (
            <span data-qa="entity-version">
              {tChat(ChatI18nKeys.VersionColon)}
              {entity.version}
            </span>
          )}

          {hasPrivateSkills && (
            <ErrorMessage
              type="warning"
              error={t(SideBarI18nKeys.QuickApp2ContainsPrivateSkills)}
            />
          )}

          <p className="text-sm text-secondary" data-qa="share-message">
            {t(SideBarI18nKeys.LinkDescription)}
          </p>
          <p className="text-sm text-secondary" data-qa="share-message">
            {t('share.modal.link', { context: sharingType })}
          </p>
          {shareFeatureType === FeatureType.Application && (
            <div className="mt-2 flex gap-2">
              <ShareAccessOption
                filterValue={t(SideBarI18nKeys.AllowEditingByOtherUsers)}
                selected={editAccess}
                onSelect={onChangeSharePermissionHandler}
              />
            </div>
          )}
          <div className="mt-2 flex justify-center gap-2">
            <div
              className="flex w-fit rounded bg-[#FCFCFC] p-3"
              data-qa="share-qr-code"
              aria-details={url}
            >
              <QRCodeSVG value={url} size={226} />
            </div>
          </div>
          <div className="relative mt-2">
            <Tooltip tooltip={url}>
              <input
                type="text"
                readOnly
                className="w-full gap-2 truncate rounded border border-primary bg-layer-3 p-3 pe-10 outline-none"
                onCopyCapture={handleCopy}
                value={url}
                data-qa="share-link"
              />
            </Tooltip>
            <div className="absolute end-3 top-3">
              {urlCopied ? (
                <Tooltip tooltip={t(SideBarI18nKeys.CopiedSideBar)}>
                  <IconCheck size={20} className="text-secondary" />
                </Tooltip>
              ) : (
                <DialGhostIconButton
                  tooltipProps={{ tooltip: t(SideBarI18nKeys.CopyURL) }}
                  size={ElementSize.Small}
                  onClick={handleCopy}
                  aria-label="copy-link"
                  icon={<IconCopy size={DEFAULT_ICON_SIZES.SMALL} />}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {shareFeatureType === FeatureType.Application && (
        <ShareAccessSection
          isShared={!!entity?.isShared}
          onUnshare={handleOpenUnshare}
          notSharedMessage={t(SideBarI18nKeys.NotSharedAppYet)}
          unshareLabel={t(SideBarI18nKeys.RemoveAccessForAllUsers)}
        />
      )}
      {isFolder ? (
        <ShareAccessSection
          isShared={!!isResourceShared}
          onUnshare={handleOpenUnshareResource}
          notSharedMessage={t(SideBarI18nKeys.NotSharedFolderYet)}
          unshareLabel={t(SideBarI18nKeys.RemoveAccessForAllUsers)}
        />
      ) : (
        (shareFeatureType === FeatureType.Chat ||
          shareFeatureType === FeatureType.Prompt) && (
          <ShareAccessSection
            isShared={!!isResourceShared}
            onUnshare={handleOpenUnshareResource}
            notSharedMessage={t(
              shareFeatureType === FeatureType.Chat
                ? SideBarI18nKeys.NotSharedChatYet
                : SideBarI18nKeys.NotSharedPromptYet,
            )}
            unshareLabel={t(SideBarI18nKeys.RemoveAccessForAllUsers)}
          />
        )
      )}
    </Modal>
  );
}

export const ShareModal = withRenderWhen(ShareSelectors.selectShareModalOpened)(
  ShareModalView,
);

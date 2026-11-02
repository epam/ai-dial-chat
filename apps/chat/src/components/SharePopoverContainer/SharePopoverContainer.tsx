import { useShareLink } from '@epam/ai-dial-chat-hooks';
import { ShareLinkAccess, SharePopover } from '@epam/ai-dial-share';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ShareI18nKeys,
} from '../../constants/translation-keys';
import { shareApi } from '../../server-api/api-client';
import { formatShareExpiryNote } from '../../utils/share';

/** Props for `SharePopoverContainer`. */
interface Props {
  /** DIAL Core id of the resource being shared. */
  itemId: string;
  /** Whether the link may grant edit access; otherwise it is view-only and the access control is a static label. */
  canEditAccess: boolean;
  /** Whether the item being shared is a QuickApp; shows the nested-items warning note when true. */
  isQuickApp?: boolean;
  /** Called when the popover should close. */
  onClose: () => void;
}

/**
 * Wires `useShareLink` to the host-agnostic `SharePopover` from
 * `@epam/ai-dial-share`, resolving all runtime data and i18n strings the lib
 * receives as flat props.
 */
const SharePopoverContainer: FC<Props> = ({
  itemId,
  canEditAccess,
  isQuickApp = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error, setAccess } = useShareLink(shareApi, itemId);

  return (
    <SharePopover
      url={data?.url}
      isLoading={isLoading}
      error={error}
      access={data?.access ?? [ShareLinkAccess.View]}
      canEditAccess={canEditAccess}
      onAccessChange={setAccess}
      onClose={onClose}
      labels={{
        title: t(ButtonsI18nKeys.Share),
        qrButtonLabel: t(ShareI18nKeys.QrButtonLabel),
        linkLabel: t(ButtonsI18nKeys.Link),
        anyoneWithLinkTitle: t(ShareI18nKeys.AnyoneWithLinkTitle),
        anyoneWithLinkSubtitle: t(ShareI18nKeys.AnyoneWithLinkSubtitle),
        accessAriaLabel: t(ShareI18nKeys.AccessAriaLabel),
        accessViewLabel: t(BasicI18nKeys.CanView),
        accessEditLabel: t(BasicI18nKeys.CanEdit),
        visibilityNote: t(ShareI18nKeys.VisibilityNote),
        visibilityNoteEdit: t(ShareI18nKeys.VisibilityNoteEdit),
        nestedItemsNote: isQuickApp
          ? t(ShareI18nKeys.NestedItemsNote)
          : undefined,
        copyButtonLabel: t(ButtonsI18nKeys.Copy),
        copiedButtonLabel: t(ShareI18nKeys.CopiedButtonLabel),
        linkAriaLabel: t(ShareI18nKeys.LinkAriaLabel),
        expiryNote: formatShareExpiryNote(data, t),
        qrCodeAriaLabel: t(ShareI18nKeys.QrCodeAriaLabel),
        qrCopyButtonLabel: t(ButtonsI18nKeys.Copy),
        qrCopiedButtonLabel: t(ShareI18nKeys.CopiedButtonLabel),
        qrDownloadButtonLabel: t(ButtonsI18nKeys.Download),
        qrDownloadFileName: t(ShareI18nKeys.QrDownloadFileName),
        loadingLabel: t(ShareI18nKeys.LoadingLabel),
        errorTitle: t(ShareI18nKeys.ErrorTitle),
      }}
    />
  );
};

export default memo(SharePopoverContainer);

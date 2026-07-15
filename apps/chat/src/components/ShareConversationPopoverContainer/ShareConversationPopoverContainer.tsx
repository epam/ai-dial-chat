import { ShareLinkAccess, SharePopover } from '@epam/ai-dial-share';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ShareI18nKeys,
} from '../../constants/translation-keys';
import { useShareLink } from '../../hooks/useShareLink/useShareLink';

/** Props for `ShareConversationPopoverContainer`. */
interface Props {
  /** The conversation's DIAL Core resource path, used as the share `itemId`. */
  conversationPath: string;
  /** Called when the popover should close. */
  onClose: () => void;
}

/** Stable reference so `SharePopover` (wrapped in `memo`) doesn't see a new `access` array every render while loading. */
const DEFAULT_ACCESS: ShareLinkAccess[] = [ShareLinkAccess.View];

/* canEditAccess=false: the access dropdown is never shown, so this is never called. */
const handleAccessChangeNoop = (): void => undefined;

/**
 * Wires `useShareLink` to the host-agnostic `SharePopover` for a conversation.
 * Conversations are always shared view-only — unlike catalog entities, there
 * is no access-level dropdown here, so `onAccessChange` is a no-op.
 */
const ShareConversationPopoverContainer: FC<Props> = ({
  conversationPath,
  onClose,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useShareLink(conversationPath);

  const labels = {
    title: t(ShareI18nKeys.Title),
    qrButtonLabel: t(ShareI18nKeys.QrButtonLabel),
    linkLabel: t(ButtonsI18nKeys.Link),
    anyoneWithLinkTitle: t(ShareI18nKeys.AnyoneWithLinkTitle),
    anyoneWithLinkSubtitle: t(ShareI18nKeys.AnyoneWithLinkSubtitle),
    accessAriaLabel: t(ShareI18nKeys.AccessAriaLabel),
    accessViewLabel: t(BasicI18nKeys.CanView),
    accessEditLabel: t(BasicI18nKeys.CanEdit),
    visibilityNote: t(ShareI18nKeys.VisibilityNoteConversation),
    copyButtonLabel: t(ButtonsI18nKeys.Copy),
    copiedButtonLabel: t(ShareI18nKeys.CopiedButtonLabel),
    linkAriaLabel: t(ShareI18nKeys.LinkAriaLabel),
    expiryNote:
      data?.expiresInDays != null
        ? t(ShareI18nKeys.ExpiryNote, { days: data.expiresInDays })
        : undefined,
    qrCodeAriaLabel: t(ShareI18nKeys.QrCodeAriaLabel),
    loadingLabel: t(ShareI18nKeys.LoadingLabel),
    errorTitle: t(ShareI18nKeys.ErrorTitle),
  };

  return (
    <SharePopover
      className="w-full"
      url={data?.url}
      isLoading={isLoading}
      error={error}
      access={data?.access ?? DEFAULT_ACCESS}
      canEditAccess={false}
      onAccessChange={handleAccessChangeNoop}
      onClose={onClose}
      labels={labels}
    />
  );
};

export default memo(ShareConversationPopoverContainer);

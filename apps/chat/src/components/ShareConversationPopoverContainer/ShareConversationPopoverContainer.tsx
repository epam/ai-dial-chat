import { ShareLinkAccess, SharePopover } from '@epam/ai-dial-share';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
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

  return (
    <SharePopover
      className="w-full"
      url={data?.url}
      isLoading={isLoading}
      error={error}
      access={data?.access ?? [ShareLinkAccess.View]}
      canEditAccess={false}
      onAccessChange={() => undefined}
      onClose={onClose}
      labels={{
        title: t(ShareI18nKeys.Title),
        qrButtonLabel: t(ShareI18nKeys.QrButtonLabel),
        linkLabel: t(ButtonsI18nKeys.Link),
        anyoneWithLinkTitle: t(ShareI18nKeys.AnyoneWithLinkTitle),
        anyoneWithLinkSubtitle: t(ShareI18nKeys.AnyoneWithLinkSubtitle),
        accessAriaLabel: t(ShareI18nKeys.AccessAriaLabel),
        accessViewLabel: t(ShareI18nKeys.AccessViewLabel),
        accessEditLabel: t(ShareI18nKeys.AccessEditLabel),
        visibilityNote: t(ShareI18nKeys.VisibilityNoteConversation),
        copyButtonLabel: t(ShareI18nKeys.CopyButtonLabel),
        copiedButtonLabel: t(ShareI18nKeys.CopiedButtonLabel),
        linkAriaLabel: t(ShareI18nKeys.LinkAriaLabel),
        expiryNote:
          data?.expiresInDays != null
            ? t(ShareI18nKeys.ExpiryNote, { days: data.expiresInDays })
            : undefined,
        qrCodeAriaLabel: t(ShareI18nKeys.QrCodeAriaLabel),
        loadingLabel: t(ShareI18nKeys.LoadingLabel),
        errorTitle: t(ShareI18nKeys.ErrorTitle),
      }}
    />
  );
};

export default memo(ShareConversationPopoverContainer);

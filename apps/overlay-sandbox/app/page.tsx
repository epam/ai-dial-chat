import Link from 'next/link';

export default async function Index() {
  return (
    <div>
      <div className="link-container">
        <span>
          <Link href={'/cases/overlay/model-id-set-sandbox'}>
            modelIdSetSandboxOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay-manager'}>OverlayManager</Link>
        </span>
        <span>
          <Link href={'/cases/overlay/disabled-header-sandbox'}>
            disabledHeaderOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-header-sandbox'}>
            enabledHeaderOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-only-header-sandbox'}>
            enabledOnlyHeaderOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-only-header-footer-sandbox'}>
            enabledOnlyHeaderFooterOverlay
          </Link>
        </span>
        <span>
          <Link
            href={
              '/cases/overlay/enabled-only-footer-links-attachments-sandbox'
            }
          >
            enabledOnlyFooterLinksAttachmentsOverlay
          </Link>
        </span>
        <span>
          <Link
            href={
              '/cases/overlay/enabled-only-header-conversations-section-sandbox'
            }
          >
            enabledOnlyHeaderConversationsSectionOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/disabled-top-chat-info-sandbox'}>
            disableTopChatInfoOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-disallow-change-agent-sandbox'}>
            enableDisallowChangeAgentOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-hide-top-context-menu-sandbox'}>
            enableHideTopContextMenuOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-empty-chat-settings-sandbox'}>
            enableEmptyChatSettingsOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-input-files-sandbox'}>
            enableInputFilesOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-hide-empty-change-agent-sandbox'}>
            enableHideEmptyChangeAgentOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/disabled-all-features-sandbox'}>
            disableAllFeaturesOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/enabled-marketplace-sandbox'}>
            enableMarketplaceOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/disabled-marketplace-sandbox'}>
            disableMarketplaceOverlay
          </Link>
        </span>
        <span>
          <Link href={'/cases/overlay/overlay-conversation-id-set-sandbox'}>
            conversationIdSetOverlay
          </Link>
        </span>
      </div>
    </div>
  );
}

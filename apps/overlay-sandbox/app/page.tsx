import Link from 'next/link';

enum OverlayCases {
  modelIdSetSandboxOverlay = '/cases/overlay/model-id-set-sandbox',
  OverlayManager = '/cases/overlay-manager',
  disabledHeaderOverlay = '/cases/overlay/disabled-header-sandbox',
  enabledHeaderOverlay = '/cases/overlay/enabled-header-sandbox',
  enabledOnlyHeaderOverlay = '/cases/overlay/enabled-only-header-sandbox',
  enabledOnlyHeaderFooterOverlay = '/cases/overlay/enabled-only-header-footer-sandbox',
  enabledOnlyFooterLinksAttachmentsOverlay = '/cases/overlay/enabled-only-footer-links-attachments-sandbox',
  enabledOnlyHeaderConversationsSectionOverlay = '/cases/overlay/enabled-only-header-conversations-section-sandbox',
  disableTopChatInfoOverlay = '/cases/overlay/disabled-top-chat-info-sandbox',
  enableDisallowChangeAgentOverlay = '/cases/overlay/enabled-disallow-change-agent-sandbox',
  enableHideTopContextMenuOverlay = '/cases/overlay/enabled-hide-top-context-menu-sandbox',
  enableEmptyChatSettingsOverlay = '/cases/overlay/enabled-empty-chat-settings-sandbox',
  enableInputFilesOverlay = '/cases/overlay/enabled-input-files-sandbox',
  enableHideEmptyChangeAgentOverlay = '/cases/overlay/enabled-hide-empty-change-agent-sandbox',
  disableAllFeaturesOverlay = '/cases/overlay/disabled-all-features-sandbox',
  enableMarketplaceOverlay = '/cases/overlay/enabled-marketplace-sandbox',
  disableMarketplaceOverlay = '/cases/overlay/disabled-marketplace-sandbox',
  conversationIdSetOverlay = '/cases/overlay/overlay-conversation-id-set-sandbox',
}

export default async function Index() {
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="font-semibold">Select mode/case for Overlay:</div>
      <ul className="flex h-full flex-wrap gap-2">
        {Object.entries(OverlayCases).map(([label, url]) => (
          <li key={label} className="button w-[380px]">
            <Link href={url}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

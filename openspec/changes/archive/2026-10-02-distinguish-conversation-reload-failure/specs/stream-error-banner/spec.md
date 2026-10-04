## ADDED Requirements

### Requirement: Conversation reload failures use a separate notification and read action

The conversation view, including application preview, SHALL render a transient reload notification when `useConversationStream` reports a terminal read failure. It SHALL NOT render that failure as an assistant `streamErrorMessage`, use the generation-failure title, or offer regeneration for the read failure. Existing generation and persistence banners SHALL remain unchanged.

The app SHALL own translation and rendering using `chat.conversationReloadErrorTitle` ("Couldn't refresh this conversation"), `chat.conversationReloadError` ("Your response is still shown here. We couldn't load the latest conversation from the server."), and `chat.retryConversationReload` ("Retry loading"). The action SHALL invoke the hook's read-only retry and be disabled while it is pending or a generation is active. The notification SHALL stay visible during retry and clear on successful reconciliation. It SHALL be announced to assistive technology, be keyboard accessible, wrap at mobile widths, have a 44px minimum touch target, and inherit RTL through logical alignment. No directional icon or breakpoint-specific JS is needed. No feature flag is introduced.

#### Scenario: Reload failure is displayed below the answer

- **WHEN** the hook reports a terminal read failure
- **THEN** the answer stays visible with a localized reload notification and Retry loading action, without an added Couldn't finish this response banner

#### Scenario: Read action never regenerates

- **WHEN** the user activates Retry loading by keyboard or pointer
- **THEN** only the retry callback is invoked and the action is disabled until that read settles

#### Scenario: Supported layout directions

- **WHEN** the reload notification appears on mobile or desktop under LTR or RTL direction
- **THEN** text uses logical alignment, the action remains reachable, and the notification does not require horizontal scrolling

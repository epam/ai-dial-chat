# OpenSpec prompt: usage limits in ConversationInput

Create an OpenSpec change for displaying the selected deployment's monthly
token usage in the main conversation input. Produce proposal, design, spec, and
tasks artifacts; do not implement the feature.

## Required behavior

- Show a compact monthly-usage indicator in both the new- and active-conversation
  composers.
- Reveal the current percentage on hover and keyboard focus, and keep it visible
  while the popover is open.
- Use the error palette when finite usage reaches 90%.
- Open an accessible popover titled `Usage Limit` with one UI Kit progress bar
  and either `N tokens remaining` or `Unlimited`.
- Refresh limits silently when the popover opens. Failures must not block typing
  or sending.
- Hide the control when no valid monthly limit is available.

## Existing integration

Reuse `GET /api/v1/deployments/:deployment/limits` through
`apps/chat/src/server-api/deployment-limits.ts`. Only `monthTokenStats` is in
scope. Totals at or above `Number.MAX_SAFE_INTEGER` are unlimited.

Keep deployment/API knowledge in `apps/chat`. Add only an optional render slot
to `libs/conversation-input`, and compose the complete control in the app.

Integrate it in:

- `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`
- `apps/chat/src/components/ConversationView/ConversationView.tsx`

## Constraints

- Reuse `DialProgressBar` from `@epam/ai-dial-ui-kit`.
- Keep strings in app-owned i18n.
- Support keyboard interaction, screen readers, touch, mobile layouts, and RTL.
- Prevent stale requests from overwriting limits after deployment changes.
- Do not add backend endpoints, polling, a global context, a feature flag, or
  changes to Catalog.
- Keep all new library props optional and document rollback.
- Add focused tests and update `docs/technical-requirements.md`.

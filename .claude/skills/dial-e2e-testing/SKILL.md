---
name: dial-e2e-testing
description: Reference for writing ai-dial-chat Playwright e2e tests - dialFixtures composition, page object and assertion patterns, test data builders, GeneratorUtil naming, setTestIds, dialTest.step structure, and anti-patterns. Use when creating or fixing e2e tests, adding fixtures, page objects, assertions, or test data builders in apps/chat-e2e.
metadata:
  author: ai-dial-chat
  version: "1.0"
---

The full e2e testing guide lives at `.claude/guides/e2e-testing-patterns.md`. Read it for the complete reference, then apply the rules below.

## When this applies

- Writing or fixing Playwright e2e tests in `apps/chat-e2e/src/tests/`
- Adding page objects, web elements, or selectors under `apps/chat-e2e/src/ui/`
- Adding assertion classes under `apps/chat-e2e/src/assertions/`
- Adding test data builders or generator utilities under `apps/chat-e2e/src/testData/`
- Testing toolset creation, API Key or OAuth sign-in/sign-out flows

## Core rules

- **Always import `dialTest`** from `@/src/core/dialFixtures`, never from `@playwright/test`
- **`setTestIds('EPMRTC-XXXX')`** is the first statement inside every test body
- **All test logic lives in `dialTest.step()` blocks** with imperative descriptions
- **Never instantiate page objects manually** — use fixture injection only
- **Always use assertion fixtures** (e.g. `conversationAssertion`) — never raw `expect(locator)` in tests
- **Use `dataInjector`**, not `apiInjector`/`browserStorageInjector` directly
- **All entity names must use the `E2E` prefix** via `GeneratorUtil.random*Name()` for auto-cleanup
- **Never write manual `afterEach` cleanup** — `beforeTestCleanup` fixture handles it automatically
- **Use `ExpectedMessages` constants** for assertion messages, never inline strings
- **Load models in `beforeAll`** via `ModelsUtil.getDefaultAgent()`, never hardcode model IDs

## Test file template

```typescript
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, GeneratorUtil, ModelsUtil } from '@/src/testData';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
});

dialTest(
  'Feature description',
  async ({ dialHomePage, someAssertion, dataInjector, conversationData, setTestIds }) => {
    setTestIds('EPMRTC-XXXX');

    await dialTest.step('Prepare test data', async () => {
      const conversation = conversationData.prepareDefaultConversation(defaultModel);
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step('Open home page', async () => {
      await dialHomePage.openHomePage({ iconsToBeLoaded: [defaultModel.iconUrl] });
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step('Verify expected state', async () => {
      await someAssertion.assertEntityState({ name: conversation.name }, 'visible');
    });
  },
);
```

## Commands

| Action | Command |
|--------|---------|
| All e2e | `npm run nx e2e chat-e2e` |
| Chat e2e only | `npm run nx e2e:chat chat-e2e` |
| Overlay e2e only | `npm run nx e2e:overlay chat-e2e` |

## Toolset auth mocking (API Key / OAuth)

Mock helpers are instantiated directly in tests — not fixtures. Always call `cleanup()` in `afterAll`.

```typescript
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';

// Build toolset via fixture
const toolset = toolsetBuilder
  .withDisplayName(GeneratorUtil.randomToolsetName())
  .withEndpoint('https://mock-toolset.example.com')
  .build();
const created = await toolsetApiHelper.createToolset(toolset);

// API Key mock
apiKeyMockHelper = new ApiKeyMockHelper(page, created, toolset.endpoint!);
await apiKeyMockHelper.setupMocks();
apiKeyMockHelper.enableMocking();
// apiKeyMockHelper.getSignInRequest() → { apiKey: string }

// OAuth mock
oauthMockHelper = new OAuthMockHelper(page, created, toolset.endpoint!);
await oauthMockHelper.setupMocks();
oauthMockHelper.enableMocking();
// After sign-in click, handle popup:
const popup = await dialHomePage.getPopup(async () => { await signInButton.click(); });
await oauthMockHelper.navigateToCallback(popup);
// oauthMockHelper.getSignInRequest() → { code, state }

// Simulate failures
new ApiKeyMockHelper(page, toolset, endpoint, { backendSignInCode: 401 });
new OAuthMockHelper(page, toolset, endpoint, { updateToolsetCode: 500 });
```

Assertion fixtures: `toolsetAuthAssertion`, `toolsetLoginModalAssertion`, `toolsetApiAuthenticationAssertion`.

See `.claude/guides/e2e-testing-patterns.md` for the full fixture map, assertion patterns, test data builders, selector rules, toolset auth details, and anti-patterns.

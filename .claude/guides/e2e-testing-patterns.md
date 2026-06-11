---
# E2E Testing Patterns

**Project**: ai-dial-chat
**Framework**: Playwright + Allure reporting
**Fixture entry point**: `apps/chat-e2e/src/core/dialFixtures.ts`
**Test location**: `apps/chat-e2e/src/tests/`

---

## Directory Structure

```
apps/chat-e2e/src/
├── core/                     # Fixture definitions
│   ├── baseFixtures.ts       # Auth, storage, base assertions, builders
│   └── dialFixtures.ts       # 480+ composed fixtures (pages, components, assertions)
├── tests/                    # Test files (.test.ts), organized by feature
├── ui/
│   ├── pages/                # Page classes (DialHomePage, MarketplacePage, …)
│   ├── webElements/          # Component classes (Chat, ChatBar, SendMessage, …)
│   ├── selectors/            # Centralized CSS/data-qa selectors
│   ├── domData/              # DOM attribute constants (Attributes, Styles)
│   └── actions/              # Login actions per auth provider
├── testData/                 # Builders, API helpers, generator utilities
├── assertions/               # Assertion classes per component
└── utils/                    # GeneratorUtil, ModelsUtil, BucketUtil, etc.
```

---

## Test File Template

```typescript
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, GeneratorUtil, ModelsUtil } from '@/src/testData';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
});

dialTest(
  'Feature description\nOptional second scenario variant',
  async ({
    dialHomePage,
    conversations,
    conversationAssertion,
    dataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-XXXX');   // Always the first statement

    await dialTest.step('Prepare test data', async () => {
      const conversation = conversationData.prepareDefaultConversation(defaultModel);
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step('Open home page', async () => {
      await dialHomePage.openHomePage({ iconsToBeLoaded: [defaultModel.iconUrl] });
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step('Verify expected state', async () => {
      await conversationAssertion.assertEntityState({ name: conversation.name }, 'visible');
    });
  },
);
```

---

## Fixture Rules

| Rule | Detail |
|------|--------|
| Always import `dialTest` | `import dialTest from '@/src/core/dialFixtures'` — never `import { test } from '@playwright/test'` |
| Use fixture injection | Never call `new PageObject(page)` — all page objects come from fixture destructuring |
| Use `dataInjector` | Not `apiInjector`/`browserStorageInjector` directly — it auto-selects the right storage |
| Lean on `beforeTestCleanup` | It runs automatically before each test and deletes all `E2E*`-prefixed entities — don't write manual `afterEach` cleanup |

---

## Test Structure Rules

- **`setTestIds()`** is always the first line inside the test body — maps to Allure TMS
- **All logic lives in `dialTest.step()` blocks** — step descriptions use imperative verbs: `'Create folder with conversation'`, `'Verify sidebar title updates'`
- **Models loaded in `beforeAll`** — store in a module-level `let` variable, pass to builders
- **`dialHomePage.openHomePage()` + `waitForPageLoaded()`** always used together for navigation

---

## Test Data Rules

Use builders via fixtures, never construct directly in tests:

```typescript
// ✅ via fixture builders
const conv = conversationData.prepareDefaultConversation(defaultModel, customName);
const folder = conversationData.prepareDefaultConversationInFolder();

// ❌ never instantiate builders directly in tests
const conv = new ConversationBuilder().withName('test').getConversation();
```

Use `GeneratorUtil` for all dynamic entity names — ensures the `E2E*` prefix that `beforeTestCleanup` uses:

```typescript
const name = GeneratorUtil.randomConversationName();   // → "E2EConversation_abc123"
const app  = GeneratorUtil.randomApplicationName();    // → "E2EApp_abc123"
```

**All test-created entity names must carry an `E2E` prefix.** This is how auto-cleanup identifies and removes them.

Available generators: `randomConversationName()`, `randomPromptName()`, `randomApplicationName()`, `randomToolsetName()`, `randomUrl()`, `randomString(length)`, `randomIntegerNumber()`, `randomArrayElement(array)`, `randomEntityVersion()`.

---

## Assertion Rules

Use component assertion fixtures — never raw `expect()` on locators in tests:

```typescript
// ✅
await conversationAssertion.assertEntityState({ name: 'My Chat' }, 'visible');
await chatHeaderAssertion.assertHeaderTitle('My Chat');

// ❌
await expect(page.locator('.conversation-name')).toBeVisible();
```

Use `expect.soft()` for multiple independent assertions so all failures are collected in one run:

```typescript
await expect.soft(element, ExpectedMessages.someMessage).toBeVisible();
```

Always use `ExpectedMessages` constants for assertion messages — never inline strings:

```typescript
await expect.soft(locator, ExpectedMessages.conversationIsVisible).toBeVisible();  // ✅
await expect.soft(locator, 'conversation should be visible').toBeVisible();         // ❌
```

---

## Selector Rules

- Never use text-based or CSS class selectors directly in tests
- Interact only through page objects and web elements provided by fixtures
- Selectors live in `ui/selectors/` using `data-qa` attributes as primary locators
- When adding selectors for new UI, add them to the appropriate file in `ui/selectors/`, never inline in a test

---

## Models

Always use `ModelsUtil`, never hardcode model IDs:

```typescript
const model = ModelsUtil.getDefaultAgent()!;          // default model
const gpt4  = ModelsUtil.getModel(ModelIds.GPT_4)!;   // specific model
```

Load in `beforeAll`, store in a module-level `let`, pass to builders as needed.

---

## Chat API Mocking

For tests that don't need a real LLM response, mock to avoid flakiness:

```typescript
await dialHomePage.mockChatTextResponse(MockedChatApiResponseBodies.simpleTextResponse);
```

For tests that verify streaming or exact response content, use `waitForExpectedResponses()` to capture the live API call.

---

## Multi-User Tests

Use pre-wired secondary user fixtures — never create a second browser context manually:

```typescript
async ({ additionalShareUserLocalStorageManager, additionalShareUserItemApiHelper }) => { ... }
```

Use `BucketUtil` for bucket-scoped data isolation between users.

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Test files | `camelCase.test.ts` | `chatBarConversation.test.ts` |
| Page classes | `PascalCase` + `Page` | `DialHomePage`, `EntityEditorPage` |
| Web element classes | `PascalCase` | `ChatBar`, `AccountSettings` |
| Assertion classes | `PascalCase` + `Assertion` | `ConversationAssertion` |
| Builder classes | `PascalCase` + `Builder` | `ConversationBuilder` |
| Test descriptions | Sentence case, imperative for steps | `'User can rename a conversation'` |
| Step descriptions | Imperative verb | `'Verify sidebar shows updated name'` |

---

## Skip / Issue Patterns

```typescript
// Associate open issue (auto-skips the test)
setIssueIds('ISSUE-123');

// Conditional skip
dialTest.skip(condition, 'reason');
```

---

## Anti-Patterns

| ❌ Avoid | ✅ Instead |
|----------|-----------|
| `new PageObject(page)` in tests | Fixture injection |
| Raw `expect(locator)` in tests | Component assertion classes |
| Hardcoded entity names | `GeneratorUtil.random*Name()` |
| `apiInjector` directly | `dataInjector` |
| Manual cleanup in `afterEach` | Auto-cleanup via `beforeTestCleanup` |
| Hardcoded model IDs | `ModelsUtil.getDefaultAgent()` |
| `import { test } from '@playwright/test'` | `import dialTest from '@/src/core/dialFixtures'` |
| Missing `setTestIds()` | Always set as first statement |
| Inline assertion messages | `ExpectedMessages` constants |

---

## Toolset Authorization Mocking

Use when testing toolset sign-in / sign-out flows with API Key or OAuth auth.

### Auth types

| `ToolsetAuthTypes` | Use case |
|--------------------|----------|
| `NONE` | Default — no auth required |
| `API_KEY` | Static API key header auth |
| `OAUTH` | OAuth authorization code flow |

### ToolsetBuilder (fixture: `toolsetBuilder`)

```typescript
const toolset = toolsetBuilder
  .withDisplayName(GeneratorUtil.randomToolsetName())  // E2EToolset_* prefix required
  .withDisplayVersion('1.0')
  .withEndpoint('https://mock-toolset.example.com')
  .withDescription('description')
  .withDescriptionKeywords('keyword1', 'keyword2')
  .withAllowedTools('tool1', 'tool2')
  .withIconUrl(iconUrl)
  .build();  // auto-resets builder — never reuse a built reference

const created = await toolsetApiHelper.createToolset(toolset);
```

### ApiKeyMockHelper

Instantiate directly in the test — not a fixture. Intercepts GET/PUT toolset routes and sign-in/out endpoints.

```typescript
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';

apiKeyMockHelper = new ApiKeyMockHelper(page, initialToolset, endpoint);
await apiKeyMockHelper.setupMocks();
apiKeyMockHelper.enableMocking();

apiKeyMockHelper.isSignedIn();           // boolean
apiKeyMockHelper.getSignInRequest();     // { apiKey: string }
apiKeyMockHelper.getSignOutRequest();    // { id: string }

await apiKeyMockHelper.cleanup();        // always cleanup, typically in afterAll
```

### OAuthMockHelper

```typescript
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';

oauthMockHelper = new OAuthMockHelper(page, initialToolset, endpoint);
await oauthMockHelper.setupMocks();
oauthMockHelper.enableMocking();

// Handle OAuth popup after sign-in click
const popup = await dialHomePage.getPopup(async () => {
  await signInButton.click();
});
await oauthMockHelper.navigateToCallback(popup);

oauthMockHelper.getOAuthState();     // { capturedOAuthUrl, capturedState, callbackUrl }
oauthMockHelper.getSignInRequest();  // { code: string; state: string }
oauthMockHelper.getMockConfig();     // client_id, scopes_supported, etc.

await oauthMockHelper.cleanup();
```

### Simulating failures

```typescript
new ApiKeyMockHelper(page, toolset, endpoint, { backendSignInCode: 401 });
new OAuthMockHelper(page, toolset, endpoint, { updateToolsetCode: 500, backendSignInCode: 403 });
```

### Partial route setup

```typescript
// Register individual routes without a full setupMocks()
await oauthMockHelper.setupToolsetRoutes();
await oauthMockHelper.setupToolsetListingRoute();
oauthMockHelper.enableMocking();
```

### Toolset assertion fixtures

```typescript
// Editor preview card auth state
await toolsetAuthAssertion.assertAuthState(
  signInRequest, expectedId, expectedCredsLabel, expectedSignInButtonTitle,
);

// Login modal UI
await toolsetLoginModalAssertion.assertModalAttributes({
  expectedName, expectedVersion, expectedApiKeyFieldValue, expectedLogInBtnState,
});

// OAuth request payloads
toolsetApiAuthenticationAssertion.assertOAuthRedirectRequest(
  oauthMockHelper.getOAuthState(), oauthMockHelper.getMockConfig(),
);
toolsetApiAuthenticationAssertion.assertSignInRequest(
  oauthMockHelper.getSignInRequest(), { code: DEFAULT_AUTHORIZATION_CODE },
);
toolsetApiAuthenticationAssertion.assertSignOutRequest(
  oauthMockHelper.getSignOutRequest(), { id: toolset.reference },
);
```

---

## Quick Reference

| Need | Location |
|------|----------|
| Fixture definitions | `apps/chat-e2e/src/core/dialFixtures.ts` |
| Page objects | `apps/chat-e2e/src/ui/pages/` |
| Web element components | `apps/chat-e2e/src/ui/webElements/` |
| Selectors | `apps/chat-e2e/src/ui/selectors/` |
| Assertion classes | `apps/chat-e2e/src/assertions/` |
| Test data builders | `apps/chat-e2e/src/testData/` |
| Toolset auth mocks | `apps/chat-e2e/src/testData/toolsets/` |
| Generator utilities | `apps/chat-e2e/src/utils/generatorUtil.ts` |
| Model utilities | `apps/chat-e2e/src/utils/modelsUtil.ts` |
| Expected messages | `apps/chat-e2e/src/testData/expectedMessages.ts` |
| Playwright config | `apps/chat-e2e/config/chat.playwright.config.ts` |

---

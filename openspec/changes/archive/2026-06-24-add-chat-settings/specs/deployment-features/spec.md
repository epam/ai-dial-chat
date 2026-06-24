## ADDED Requirements

### Requirement: ResponseFormat enum in libs/chat-shared

`libs/chat-shared/src/models/deployment-features.ts` SHALL export a `ResponseFormat` string enum:

```ts
export enum ResponseFormat {
  Markdown = 'markdown',
  PlainText = 'plain_text',
}
```

The enum SHALL be re-exported from the `libs/chat-shared` barrel (`src/index.ts`).

#### Scenario: Enum is importable from chat-shared

- **WHEN** application code imports `ResponseFormat` from `@epam/ai-dial-chat-shared`
- **THEN** `ResponseFormat.Markdown` equals `'markdown'` and `ResponseFormat.PlainText` equals `'plain_text'`

---

### Requirement: DeploymentFeatures interface in libs/chat-shared

`libs/chat-shared/src/models/deployment-features.ts` SHALL export the following interface:

```ts
export interface DeploymentFeatures {
  /** Whether the deployment supports a custom system prompt. */
  systemPrompt: boolean;
  /** Whether the deployment supports temperature control. */
  temperature: boolean;
  /** Whether the deployment supports response format selection. */
  responseFormat?: boolean;
}
```

The interface SHALL be re-exported from the `libs/chat-shared` barrel (`src/index.ts`).

#### Scenario: Interface is importable from chat-shared

- **WHEN** application code imports `DeploymentFeatures` from `@epam/ai-dial-chat-shared`
- **THEN** the type is available with `systemPrompt: boolean`, `temperature: boolean`, and optional `responseFormat?: boolean` properties

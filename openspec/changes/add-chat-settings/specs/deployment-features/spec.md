## ADDED Requirements

### Requirement: DeploymentFeatures interface in libs/chat-shared

`libs/chat-shared/src/models/deployment-features.ts` SHALL export the following interface:

```ts
export interface DeploymentFeatures {
  /** Whether the deployment supports a custom system prompt. */
  systemPrompt: boolean;
  /** Whether the deployment supports temperature control. */
  temperature: boolean;
}
```

The interface SHALL be re-exported from the `libs/chat-shared` barrel (`src/index.ts`).

#### Scenario: Interface is importable from chat-shared

- **WHEN** application code imports `DeploymentFeatures` from `@epam/ai-dial-chat-shared`
- **THEN** the type is available with `systemPrompt: boolean` and `temperature: boolean` properties

/** Response format options for conversation messages. */
export enum ResponseFormat {
  /** Messages are rendered as Markdown. */
  Markdown = 'markdown',
  /** Messages are rendered as plain text. */
  PlainText = 'plain_text',
}

/** Feature flags for a deployment, controlling which per-conversation settings are available. */
export interface DeploymentFeatures {
  /** Whether the deployment supports a custom system prompt. */
  systemPrompt: boolean;
  /** Whether the deployment supports temperature control. */
  temperature: boolean;
  /** Whether the deployment supports response format selection. */
  responseFormat?: boolean;
}

/** Feature flags for a deployment, controlling which per-conversation settings are available. */
export interface DeploymentFeatures {
  /** Whether the deployment supports a custom system prompt. */
  systemPrompt: boolean;
  /** Whether the deployment supports temperature control. */
  temperature: boolean;
}

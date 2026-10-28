/** Query-string params that preselect an entity on the new-conversation route (`/`). */
export enum UrlPreselectionQuery {
  /** Deployment (Model, Agent or Application) to select for a new conversation. */
  DeploymentId = 'deployment-id',
  /** Skill resource id (`skills/{bucket}/{path}`) to add to the message input as a mention. */
  SkillId = 'skill-id',
  /** Prompt resource id (`prompts/{bucket}/{path}`) to apply to the message input. */
  PromptId = 'prompt-id',
}

/**
 * The upstream generation protocol a completion request is routed through.
 * Resolved once per `streamCompletion` call from the target deployment's
 * resolved `features.responsesApi` flag — never chosen by the frontend.
 */
export enum GenerationApi {
  Responses = 'responses',
  ChatCompletions = 'chat_completions',
}

export interface GenerationApiFeatures {
  responsesApi?: boolean;
}

/**
 * Pure routing decision: a deployment moves to the Responses API only when
 * it explicitly declares `responsesApi: true`. A missing `features` object
 * or a missing/`false` `responsesApi` field falls back to Chat Completions,
 * so older Core payloads (or deployments that simply don't support
 * Responses) keep their current behavior unchanged.
 */
export const resolveGenerationApi = (
  features?: GenerationApiFeatures,
): GenerationApi =>
  features?.responsesApi === true
    ? GenerationApi.Responses
    : GenerationApi.ChatCompletions;

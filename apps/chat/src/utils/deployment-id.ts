import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';

/**
 * Percent-encodes each `/`-separated segment of a deployment/application id
 * so it satisfies the backend's `DEPLOYMENT_ID_PATTERN` (spaces and other
 * reserved characters must be percent-encoded; `/` stays a literal path
 * separator). Applications created via `POST /api/v1/applications` return an
 * id built from the raw, human-readable name (e.g. `applications/<bucket>/My
 * App__1.0`), which is only ever consumed by the settings iframe's postMessage
 * protocol elsewhere — anywhere that id is used as a chat `deploymentId`, it
 * must be encoded first.
 */
export const encodeDeploymentId = (id: string): string =>
  id
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

/**
 * Finds a deployment matching `idOrReference` by `id` first, falling back to
 * `reference` when no `id` matches. DIAL Core sometimes addresses a
 * deployment by `reference` in places that store a deployment id (e.g. a
 * conversation's or message's `model.id`), so lookups against the fetched
 * deployments list must accept either value.
 */
export const findDeploymentByIdOrReference = (
  deployments: DeploymentItemDto[],
  idOrReference: string | null | undefined,
): DeploymentItemDto | undefined => {
  if (!idOrReference) return undefined;
  return (
    deployments.find((deployment) => deployment.id === idOrReference) ??
    deployments.find((deployment) => deployment.reference === idOrReference)
  );
};

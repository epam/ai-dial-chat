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

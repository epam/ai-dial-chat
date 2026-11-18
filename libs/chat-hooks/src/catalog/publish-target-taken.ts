import { PublishConflictCode } from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '../api-error/api-error';
import { withApiErrorMapping } from '../api-error/map-api-error';

/**
 * A publish rejected because the published path already holds another resource
 * (`409` with code `target-exists`). Thrown by {@link wrapPublishTargetTaken} so
 * a synchronous predicate can recognise it.
 */
export class PublishTargetTakenError extends Error {
  /**
   * @param cause - the rejection of the generated-client call
   */
  constructor(cause: unknown) {
    super('The published path is already taken', { cause });
    this.name = 'PublishTargetTakenError';
  }
}

/**
 * Whether `error` is the publish endpoint's `409` for a taken target.
 * @param error - the rejection of a generated-client call
 */
export const isPublishTargetTakenResponse = async (
  error: unknown,
): Promise<boolean> => {
  const { status, code } = await getApiErrorDetails(error);
  return status === 409 && code === PublishConflictCode.TargetExists;
};

/**
 * Returns `publish` rejecting a taken-target `409` as a {@link PublishTargetTakenError}
 * and every other failure unchanged. Reading the error body is asynchronous, so the
 * conversion happens here, before `usePublishFlow`'s synchronous predicate sees it.
 * @param publish - the host's publish request
 */
export const wrapPublishTargetTaken = <Args extends unknown[], Result>(
  publish: (...args: Args) => Promise<Result>,
) =>
  withApiErrorMapping(publish, async (error) =>
    (await isPublishTargetTakenResponse(error))
      ? new PublishTargetTakenError(error)
      : undefined,
  );

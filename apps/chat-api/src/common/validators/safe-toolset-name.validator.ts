import { type ValidationOptions } from 'class-validator';
import {
  IsSafeResourceId,
  isSafeResourceId,
} from './safe-resource-id.validator';

/*
 * Toolset names legitimately need `/` for custom toolset paths
 * (`toolsets/{bucket}/{path}`, see ToolsetsService.parseDialToolsetResource),
 * so they use the shared segment-level traversal guard — see
 * safe-resource-id.validator.ts and GitHub #7925.
 */
export const isSafeToolsetName = (value: unknown): value is string =>
  isSafeResourceId(value);

export const IsSafeToolsetName = (validationOptions?: ValidationOptions) =>
  IsSafeResourceId({
    message:
      'Toolset name must contain only supported characters or valid ' +
      'percent-encoded bytes, and must not contain empty, dot, or ' +
      'dot-dot path segments, including when encoded',
    ...validationOptions,
  });

import { ConflictException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Domain code on a `409` that rejects a publication: the derived target already
 * holds a resource, or the same application is already being published.
 * Distinct from `ResourceNameConflictCode`, which names a duplicate inside the
 * caller's own bucket.
 */
export enum PublishConflictCode {
  /** The published copy's path is already taken, by another author's resource or an earlier publication. */
  TargetExists = 'target-exists',
  /** Another publish of the same application is in flight, so a second one cannot start yet. */
  PublishInProgress = 'publish-in-progress',
}

/** Message of the publish endpoint's `409` for a taken target. */
export const TARGET_EXISTS_MESSAGE =
  'A resource with this name already exists in the target folder. Rename it, change its version or choose another folder';

/**
 * The `409` for a target that holds a resource, carrying the taken-target code.
 * @param message - the user-facing message; defaults to the publish endpoint's
 */
export const createTargetExistsConflict = (
  message: string = TARGET_EXISTS_MESSAGE,
): ConflictException =>
  new ConflictException({
    statusCode: 409,
    message,
    error: 'Conflict',
    code: PublishConflictCode.TargetExists,
  });

/** Error body of a publish rejected with `409`: the target already exists, or the same application is already being published. */
export class PublishConflictDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    example:
      'A resource with this name already exists in the target folder. Rename it, change its version or choose another folder',
  })
  message!: string;

  @ApiProperty({ example: 'Conflict' })
  error!: string;

  @ApiProperty({
    enum: PublishConflictCode,
    enumName: 'PublishConflictCode',
    description:
      '`target-exists`: the published copy of this resource would land on a path that is already taken. `publish-in-progress`: another publish of the same application has not finished yet.',
  })
  code!: PublishConflictCode;
}

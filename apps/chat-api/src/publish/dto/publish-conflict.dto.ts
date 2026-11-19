import { ApiProperty } from '@nestjs/swagger';

/**
 * Domain code on a `409` that rejects a publication because the derived target
 * already holds a resource. Distinct from `ResourceNameConflictCode`, which
 * names a duplicate inside the caller's own bucket.
 */
export enum PublishConflictCode {
  /** The published copy's path is already taken, by another author's resource or an earlier publication. */
  TargetExists = 'target-exists',
}

/** Error body of a publish rejected with `409` because the target already exists. */
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
      'Always `target-exists`: the published copy of this resource would land on a path that is already taken.',
  })
  code!: PublishConflictCode;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceNameConflictCode } from '../types/resource-name-conflict-code';

/**
 * Error body of a toolset or application write rejected with `409`. `code` is
 * set when another own entity in the same folder and catalog tab already has
 * the displayed name and version; it is absent when every candidate storage
 * path is taken or the target path exists.
 */
export class ResourceNameConflictDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    example:
      'An agent with this name and version already exists in this folder',
  })
  message!: string;

  @ApiProperty({ example: 'Conflict' })
  error!: string;

  @ApiPropertyOptional({
    enum: ResourceNameConflictCode,
    enumName: 'ResourceNameConflictCode',
    description:
      'Kind of the entity that already holds the displayed name and version.',
  })
  code?: ResourceNameConflictCode;
}

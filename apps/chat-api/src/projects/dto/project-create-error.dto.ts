import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectCreateErrorCode } from '../types/project-create-error-code.enum';

/** Error body of `POST /api/v1/projects`. ValidationPipe errors have no domain code. */
export class ProjectCreateErrorDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiProperty({ example: 'Conflict' })
  error!: string;

  @ApiPropertyOptional({
    enum: ProjectCreateErrorCode,
    enumName: 'ProjectCreateErrorCode',
  })
  code?: ProjectCreateErrorCode;

  @ApiPropertyOptional({
    example: 'name',
    description: '`name`, or the name of the rejected context file.',
  })
  field?: string;
}

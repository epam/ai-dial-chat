import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduledTaskErrorCode } from '../types/scheduled-task-error-code.enum';

/** ValidationPipe errors have no domain code and may contain multiple messages. */
export class ScheduledTaskValidationErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiPropertyOptional({
    enum: ScheduledTaskErrorCode,
    enumName: 'ScheduledTaskErrorCode',
  })
  code?: ScheduledTaskErrorCode;

  @ApiPropertyOptional({ example: 'skillUrl' })
  field?: string;
}

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

  @ApiPropertyOptional({ example: 'skillUrls' })
  field?: string;

  @ApiPropertyOptional({
    example: 'Application consent revoked',
    description:
      "DIAL Scheduler's own error reason, trimmed and capped at 1000 characters. Never present for 401/403/404.",
  })
  upstreamMessage?: string;

  @ApiPropertyOptional({
    example: 'consent_revoked',
    description:
      "DIAL Scheduler's own error code (matches ^[A-Za-z0-9_.:-]{1,128}$). Never present for 401/403/404.",
  })
  upstreamCode?: string;
}

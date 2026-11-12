import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationErrorCode } from '../types/application-error-code.enum';
import { DEPENDENT_RESOURCE_MISSING_MESSAGE } from '../utils/application-save-error';

/** Error body for a refused `POST /api/v1/applications` or `PATCH /api/v1/applications/:applicationName`. */
export class ApplicationErrorDto {
  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({ example: 'Forbidden' })
  error!: string;

  @ApiProperty({ example: DEPENDENT_RESOURCE_MISSING_MESSAGE })
  message!: string;

  @ApiPropertyOptional({
    enum: ApplicationErrorCode,
    enumName: 'ApplicationErrorCode',
    description:
      'Why DIAL Core refused the save. `applicationDependentResourceMissing`: a resource the application depends on is no longer available.',
  })
  code?: ApplicationErrorCode;
}

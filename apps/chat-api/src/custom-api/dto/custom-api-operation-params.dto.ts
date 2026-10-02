import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** Matches CustomApiRegistryService's operation id grammar. */
export const CUSTOM_API_OPERATION_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export class CustomApiOperationParamsDto {
  @ApiProperty({
    description:
      'Operation ID from the deployment-configured CUSTOM_CORE_API_CONFIG registry.',
    example: 'data-products',
    pattern: CUSTOM_API_OPERATION_ID_PATTERN.source,
  })
  @Matches(CUSTOM_API_OPERATION_ID_PATTERN, {
    message: 'id must match ^[a-z][a-z0-9-]{0,63}$',
  })
  id!: string;
}

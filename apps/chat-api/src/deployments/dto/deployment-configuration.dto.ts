import { ApiPropertyOptional } from '@nestjs/swagger';

/** Mapped deployment configuration returned to the frontend. */
export class DeploymentConfigurationDto {
  @ApiPropertyOptional({ description: 'JSON Schema type (typically "object")' })
  type?: string;

  @ApiPropertyOptional({ description: 'Human-readable schema title' })
  title?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Named configuration properties supported by this deployment',
  })
  properties?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Whether additional properties are allowed',
  })
  additionalProperties?: boolean | Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'When true, the application does not accept free-form text input; users interact only via form/action buttons.',
  })
  isChatMessageInputDisabled?: boolean;
}

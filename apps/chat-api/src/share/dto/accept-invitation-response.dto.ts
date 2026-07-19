import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeploymentItemDto } from '../../deployments/dto/deployment-item.dto';
import { DialToolsetDto } from '../../openapi/openapi-response.dto';

/** Response body for `GET /api/v1/share/invitations/:invitationId`. */
export class AcceptInvitationResponseDto {
  @ApiProperty({
    description:
      'Identifier (DIAL Core resource path) of the entity the invitation grants access to.',
    example: 'gpt-4o',
  })
  itemId!: string;

  @ApiPropertyOptional({
    description:
      'List-item summary of the shared model/application, resolved by id at accept time so the frontend can show its details panel without waiting on a bulk deployments list refresh. Omitted when itemId is a toolset, or when resolution failed (a best-effort step that never fails the accept call itself).',
    type: () => DeploymentItemDto,
  })
  sharedDeployment?: DeploymentItemDto;

  @ApiPropertyOptional({
    description:
      'List-item summary of the shared toolset, resolved by id at accept time so the frontend can show its details panel without waiting on a bulk toolsets list refresh. Omitted when itemId is not a toolset, or when resolution failed (a best-effort step that never fails the accept call itself).',
    type: () => DialToolsetDto,
  })
  sharedToolset?: DialToolsetDto;
}

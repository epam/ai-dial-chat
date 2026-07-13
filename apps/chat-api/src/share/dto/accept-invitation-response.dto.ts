import { ApiProperty } from '@nestjs/swagger';

/** Response body for `GET /api/v1/share/invitations/:invitationId`. */
export class AcceptInvitationResponseDto {
  @ApiProperty({
    description:
      'Identifier (DIAL Core resource path) of the entity the invitation grants access to.',
    example: 'gpt-4o',
  })
  itemId!: string;
}

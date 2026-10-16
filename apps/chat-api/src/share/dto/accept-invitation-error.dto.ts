import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShareInvitationErrorCode } from '../types/share-invitation-error-code.enum';

/** Error body for a refused `GET /api/v1/share/invitations/:invitationId`. */
export class AcceptInvitationErrorDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'Not Found' })
  error!: string;

  @ApiProperty({ example: 'The share link has expired or does not exist' })
  message!: string;

  @ApiPropertyOptional({
    enum: ShareInvitationErrorCode,
    enumName: 'ShareInvitationErrorCode',
    description:
      'Why DIAL Core refused the invitation. `shareInvitationNotFound`: the link expired, was revoked, or never existed. `shareInvitationAcceptedUsersLimitReached`: the shared resource has already been accepted by its maximum number of users.',
  })
  code?: ShareInvitationErrorCode;

  @ApiPropertyOptional({
    description:
      'Title of the shared conversation, present with `shareInvitationAcceptedUsersLimitReached` when the invitation shares a conversation.',
    example: 'Quarterly planning',
  })
  itemName?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import {
  INVITATION_ID_PATTERN,
  INVITATION_ID_VALIDATION_MESSAGE,
} from '../../common/validators/invitation-id.pattern';

/** Path params for `GET /api/v1/share/invitations/:invitationId`. */
export class GetInvitationDto {
  @ApiProperty({
    description: 'Invitation identifier extracted from the share link.',
    example: 'abc123',
    pattern: INVITATION_ID_PATTERN.source,
  })
  @IsString()
  @Matches(INVITATION_ID_PATTERN, {
    message: INVITATION_ID_VALIDATION_MESSAGE,
  })
  invitationId!: string;
}

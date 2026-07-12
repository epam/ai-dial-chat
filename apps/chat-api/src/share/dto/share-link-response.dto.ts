import { ApiProperty } from '@nestjs/swagger';
import { ShareAccess } from './create-share-link.dto';

/** Response body for `POST /api/v1/share`. */
export class ShareLinkResponseDto {
  @ApiProperty({
    description: 'Absolute shareable URL for the entity.',
    example: 'https://chat.dialx.ai/marketplace/share/gpt-4o',
  })
  url!: string;

  @ApiProperty({
    description: 'Number of days the link stays active before expiring.',
    example: 3,
  })
  expiresInDays!: number;

  @ApiProperty({
    description:
      'Access levels granted to holders of the share link. Edit access implies view access, so this is `[View, Edit]` rather than `[Edit]` alone.',
    enum: ShareAccess,
    isArray: true,
    example: [ShareAccess.View],
  })
  access!: ShareAccess[];
}

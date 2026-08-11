import { ApiProperty } from '@nestjs/swagger';

export class AnnouncementLinkDto {
  @ApiProperty({
    description:
      'Visible label of the announcement call to action. Plain text; never interpreted as markup.',
    example: 'Changelog',
  })
  label!: string;

  @ApiProperty({
    description:
      'Absolute http(s) URL the announcement links to. Opened in a new tab with rel="noopener noreferrer". Entries carrying other schemes are dropped server-side.',
    example: 'https://dialx.ai/changelog',
  })
  href!: string;
}

export class AnnouncementItemDto {
  @ApiProperty({
    description:
      'Announcement heading. Plain text; never interpreted as markup. Entries without one are dropped server-side.',
    example: 'We have upgraded to DIAL 1.43 🎉',
  })
  title!: string;

  @ApiProperty({
    description:
      'Supporting copy, sanitized to a safe HTML subset. Null when unset or when sanitization removes everything.',
    example: "Check what's new:",
    nullable: true,
    type: String,
  })
  description!: string | null;

  @ApiProperty({
    description:
      'Optional call to action. Null when the announcement is informational only. An entry whose link is present but invalid is dropped entirely rather than returned without it.',
    nullable: true,
    type: AnnouncementLinkDto,
  })
  link!: AnnouncementLinkDto | null;
}

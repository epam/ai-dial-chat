import { ApiProperty } from '@nestjs/swagger';

/** Whether the session user may request removal of one catalog entity. */
export class UnpublishAccessDto {
  @ApiProperty({
    description:
      'Whether the caller may request removal of this entity: true for an administrator or the publisher of the copy',
    example: true,
  })
  canUnpublish!: boolean;
}

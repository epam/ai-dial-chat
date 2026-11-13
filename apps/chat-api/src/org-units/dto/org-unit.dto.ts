import { ApiProperty } from '@nestjs/swagger';

/** One DIAL Core org unit the caller may see. */
export class OrgUnitDto {
  @ApiProperty({ description: 'Core unit id', example: 'u-risk' })
  id!: string;

  @ApiProperty({
    description: 'Unit name; also the last segment of its folder',
    example: 'US Risk',
  })
  name!: string;

  @ApiProperty({
    description: 'Display name; falls back to `name` when Core has none',
    example: 'US Risk',
  })
  displayName!: string;

  @ApiProperty({
    description: 'Decoded unit address without a trailing slash',
    example: 'public/Acme/US Risk',
  })
  path!: string;

  @ApiProperty({
    description:
      'Unit folder exactly as DIAL Core returns it: url-encoded, with a trailing slash',
    example: 'public/Acme/US%20Risk/',
  })
  folder!: string;
}

/** The org units visible to the caller, flat, parents before children. */
export class OrgUnitsResponseDto {
  @ApiProperty({
    description: '`false` when DIAL Core has org units turned off',
    example: true,
  })
  enabled!: boolean;

  @ApiProperty({ type: () => [OrgUnitDto] })
  units!: OrgUnitDto[];
}

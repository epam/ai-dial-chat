import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  CELEBRATION_ID_MAX_LENGTH,
  CELEBRATION_ID_PATTERN,
  CELEBRATION_VERSION_PATTERN,
} from '../constants/celebrations.constants';

export class GetCelebrationPackDto {
  @ApiProperty({
    description: 'Pack ID, lowercase kebab-case, at most 64 characters.',
    example: 'new-year-default',
    type: String,
  })
  @IsString()
  @MaxLength(CELEBRATION_ID_MAX_LENGTH)
  @Matches(CELEBRATION_ID_PATTERN, {
    message: 'packId must be a lowercase kebab-case identifier',
  })
  packId!: string;

  @ApiProperty({
    description: 'Pack version, strict MAJOR.MINOR.PATCH.',
    example: '1.0.0',
    type: String,
  })
  @IsString()
  @Matches(CELEBRATION_VERSION_PATTERN, {
    message: 'version must be a MAJOR.MINOR.PATCH version',
  })
  version!: string;
}

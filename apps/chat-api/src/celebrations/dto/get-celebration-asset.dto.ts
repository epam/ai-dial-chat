import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { CELEBRATION_ASSET_ID_PATTERN } from '../constants/celebrations.constants';

export class GetCelebrationAssetDto {
  @ApiProperty({
    description:
      'Asset ID: lowercase letters, digits and dashes, at most 96 characters.',
    example: 'new-year-default-snowman-delivery-poster-8e2d4a6c0f1b3957',
    type: String,
  })
  @IsString()
  @Matches(CELEBRATION_ASSET_ID_PATTERN, {
    message: 'assetId must be a lowercase asset identifier',
  })
  assetId!: string;
}

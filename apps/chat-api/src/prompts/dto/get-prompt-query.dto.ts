import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { RequiredPromptPathDto } from './required-prompt-path.dto';

export class GetPromptQueryDto extends RequiredPromptPathDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @ApiPropertyOptional({
    description:
      "DIAL Core bucket to read from. Defaults to the caller's own bucket; pass the owner bucket reported as `bucket` on a shared prompt to read that one. DIAL Core still enforces access, so a bucket the caller has no grant for resolves to 404.",
    example: 'owner-bucket',
  })
  bucket?: string;
}

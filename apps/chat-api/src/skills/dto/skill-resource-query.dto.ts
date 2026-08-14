import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { SkillFilePathField } from './skill-file-path.dto';

/** Query params for `GET /api/v1/skills/download` (whole-skill download). */
export class SkillResourceQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiProperty({
    description: "The skill's resource path within the bucket",
    example: 'team-a/docs-helper',
  })
  path!: string;
}

/** Query params for `GET /api/v1/skills/files/download` (single-file download). */
export class SkillFileResourceQueryDto extends SkillResourceQueryDto {
  @SkillFilePathField()
  filePath!: string;
}

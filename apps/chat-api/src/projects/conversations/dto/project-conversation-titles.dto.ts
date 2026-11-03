import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  DIAL_PATH_SEGMENT_MAX_BYTES,
  IsSafeDialPathSegment,
} from '../../../common/validators/dial-entity-name.validator';
import { MaxUtf8ByteLength } from '../../../conversations/dto/max-utf8-byte-length.validator';
import { ProjectConversationItemDto } from './project-conversation-list-response.dto';

/** Most conversation names one `POST /api/v1/projects/:id/conversations/titles` resolves. */
export const PROJECT_CONVERSATION_TITLES_MAX_NAMES = 100;

/** Body of `POST /api/v1/projects/:id/conversations/titles`. */
export class ProjectConversationTitlesBodyDto {
  @ApiProperty({
    description:
      'File names under the project `conversations/` folder, as listed in `name`. Duplicates are resolved once; names the project does not hold are omitted.',
    type: [String],
    minItems: 1,
    maxItems: PROJECT_CONVERSATION_TITLES_MAX_NAMES,
    example: ['gpt-4o__Weekly support health summary__7c1d'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PROJECT_CONVERSATION_TITLES_MAX_NAMES)
  @IsString({ each: true })
  @IsSafeDialPathSegment({ each: true })
  @MaxUtf8ByteLength(DIAL_PATH_SEGMENT_MAX_BYTES, { each: true })
  names!: string[];
}

/** Response of `POST /api/v1/projects/:id/conversations/titles`. */
export class ProjectConversationTitlesResponseDto {
  @ApiProperty({
    type: [ProjectConversationItemDto],
    description:
      'The requested conversations the project holds, in request order, with their titles and read state resolved.',
  })
  @ValidateNested({ each: true })
  items!: ProjectConversationItemDto[];
}

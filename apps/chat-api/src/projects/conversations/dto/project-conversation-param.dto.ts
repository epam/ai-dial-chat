import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import {
  DIAL_PATH_SEGMENT_MAX_BYTES,
  IsSafeDialPathSegment,
} from '../../../common/validators/dial-entity-name.validator';
import { MaxUtf8ByteLength } from '../../../conversations/dto/max-utf8-byte-length.validator';
import { ProjectIdParamDto } from '../../dto/project-id-param.dto';

/** `:id` and `:conversationName` path params of one project conversation. */
export class ProjectConversationParamDto extends ProjectIdParamDto {
  @ApiProperty({
    description:
      'File name of the conversation directly under the project `conversations/` folder, `{deploymentId}__{title}__{uuid}`.',
    example: 'gpt-4o__Weekly support health summary__7c1d',
  })
  @IsString()
  @IsSafeDialPathSegment()
  @MaxUtf8ByteLength(DIAL_PATH_SEGMENT_MAX_BYTES)
  conversationName!: string;
}

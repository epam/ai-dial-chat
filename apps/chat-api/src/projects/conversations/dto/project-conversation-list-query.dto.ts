import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Default page size of `GET /api/v1/projects/:id/conversations`. */
export const PROJECT_CONVERSATION_LIST_DEFAULT_LIMIT = 50;
/** Largest page size of `GET /api/v1/projects/:id/conversations`. */
export const PROJECT_CONVERSATION_LIST_MAX_LIMIT = 100;

const toOptionalNumber = ({ value }: { value: unknown }) =>
  value != null ? Number(value) : undefined;

/** Query of `GET /api/v1/projects/:id/conversations`. */
export class ProjectConversationListQueryDto {
  @ApiPropertyOptional({
    description:
      'Maximum number of conversations to return, newest first. `hasMore` tells whether more exist.',
    example: PROJECT_CONVERSATION_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PROJECT_CONVERSATION_LIST_MAX_LIMIT,
    default: PROJECT_CONVERSATION_LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PROJECT_CONVERSATION_LIST_MAX_LIMIT)
  @Transform(toOptionalNumber)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Number of conversations to skip in the newest-first order; the next page starts at the count already loaded.',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(toOptionalNumber)
  offset?: number;
}

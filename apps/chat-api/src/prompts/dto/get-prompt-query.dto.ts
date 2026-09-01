import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  PROMPT_ID_PATTERN,
  PROMPT_ID_VALIDATION_MESSAGE,
} from '../constants/prompt-path.constants';

/*
 * Shared by every prompt endpoint that identifies one specific prompt by its
 * full resource path — get/update/delete/move all take the same single `id`,
 * mirroring how the share domain's discard/revoke/recipients endpoints take
 * one `itemId`. DIAL Core alone decides whether the caller may act on the
 * resource `id` names; this DTO only rejects malformed input before that.
 */
export class GetPromptQueryDto {
  @ApiProperty({
    description:
      "Full prompt resource path (`prompts/{bucket}/{path}`). Use the caller's own bucket for a personal prompt, or the owner bucket reported on a shared prompt's `id`. DIAL Core still enforces access, so an id the caller has no grant for resolves to 404.",
    example: 'prompts/owner-bucket/Work/AI/summarize',
    maxLength: 2048,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(PROMPT_ID_PATTERN, {
    message: PROMPT_ID_VALIDATION_MESSAGE,
  })
  id!: string;
}

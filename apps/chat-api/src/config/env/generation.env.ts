import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Models, utility prompts, naming, transcription and generation timeouts. */
export class GenerationEnv {
  @IsOptional()
  @IsString()
  ASR_MODEL?: string;

  @IsOptional()
  @IsString()
  UTILITY_MODEL?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_SKILL_DESCRIPTION_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_SKILL_INSTRUCTIONS_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_SCHEDULED_TASK_DESCRIPTION_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_SCHEDULED_TASK_INSTRUCTIONS_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_APPLICATION_DESCRIPTION_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_TOOLSET_DESCRIPTION_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_PROMPT_DESCRIPTION_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_PROMPT_INSTRUCTIONS_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_PROJECT_DESCRIPTION_PROMPT?: string;

  @IsOptional()
  @IsString()
  TEXT_REFINEMENT_PROJECT_INSTRUCTIONS_PROMPT?: string;

  @IsOptional()
  @IsString()
  CONVERSATION_NAMING_SYSTEM_PROMPT?: string;

  @IsOptional()
  @IsString()
  TRANSCRIPTION_PROMPT?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  UTILITY_NAMING_TIMEOUT_MS?: number = 10_000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  TRANSCRIBE_SIZE_LIMIT_BYTES?: number = 5 * 1024 * 1024;

  /*
   * Server-owned bound on how long an active generation may occupy the
   * in-memory registry (see openspec/specs/generation-registry/spec.md),
   * independent of the originating browser connection — a disconnect no
   * longer aborts a generation, so this timer is what protects against a
   * stalled upstream stream that never reaches a terminal event.
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  MAX_GENERATION_DURATION_MS?: number = 1_800_000;

  /*
   * Bounds subscriber and resource release, never ownership (see
   * openspec/specs/generation-registry/spec.md): if a generation's terminal
   * write has not settled this long after being dispatched, attach
   * subscribers are released and the entry moves to the retained `settling`
   * state, still owning its registry key so a replacement is never admitted
   * over an unsettled write.
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  GENERATION_FINALIZE_TIMEOUT_MS?: number = 60_000;

  /*
   * Bounds how long a completion may wait in preparation — the hidden-model
   * check, capability resolution, the stored-conversation read and the
   * start-state save — before SSE headers are sent (see
   * openspec/specs/generation-registry/spec.md). On expiry the request fails
   * with 503 and attach subscribers are released, but the entry keeps its
   * registry key (`settling`) until the abandoned DIAL Core call settles: the
   * bound stops the wait, never the remote work.
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  GENERATION_PREPARATION_TIMEOUT_MS?: number = 30_000;
}

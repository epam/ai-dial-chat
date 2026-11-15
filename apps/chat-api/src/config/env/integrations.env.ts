import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import {
  DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS,
  DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
  DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
  parseProjectContextExtensions,
  PROJECT_CONTEXT_EXTENSION_PATTERN,
} from '../../projects/constants/project-context.constants';

/** DIAL Scheduler, custom Core API and project-context limits. */
export class IntegrationsEnv {
  /*
   * Server-only allowlist of exact GET Core paths exposed through
   * GET /api/v1/custom-api/:operationId (see
   * openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md). JSON object,
   * `{"version":1,"operations":[{"id":...,"method":"GET","corePath":...}]}`.
   * Unset, empty or whitespace-only values mean no operations are enabled.
   * Parsed and bounded by CustomApiRegistryService, not by this schema, so an
   * invalid value fails startup there rather than here; this field is kept a
   * permissive string so the registry service controls the exact error. Never
   * exposed through client-config, CUSTOM_CLIENT_VARIABLES or browser build
   * variables. Restart chat-api after changing.
   */
  @IsOptional()
  @IsString()
  CUSTOM_CORE_API_CONFIG?: string;

  /*
   * Project context limits, enforced by `POST /api/v1/projects` and
   * published to the browser as `projects.*` client config. Keep them at or
   * below DIAL Core's `complexResource.types.projects` limits (built-in:
   * 5 MiB per file, 64 MiB total). `validate` also requires
   * TOTAL >= FILE, and TOTAL <= the 64 MiB project read limit minus the
   * 1 MiB PROJECT.md limit (63 MiB), so every project stays editable.
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  PROJECT_CONTEXT_FILE_MAX_BYTES?: number =
    DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  PROJECT_CONTEXT_TOTAL_MAX_BYTES?: number =
    DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES;

  @IsOptional()
  @Transform(({ value }) => parseProjectContextExtensions(value))
  @IsArray()
  @Matches(PROJECT_CONTEXT_EXTENSION_PATTERN, {
    each: true,
    message:
      'PROJECT_CONTEXT_ALLOWED_EXTENSIONS entries must be 1-16 lower-case letters or digits',
  })
  PROJECT_CONTEXT_ALLOWED_EXTENSIONS?: string[] = [
    ...DEFAULT_PROJECT_CONTEXT_ALLOWED_EXTENSIONS,
  ];

  @IsOptional()
  @IsString()
  SCHEDULER_APP_ID?: string;

  @IsOptional()
  @IsString()
  SCHEDULER_SERVICE_ID?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  SCHEDULER_SERVICE_TIMEOUT_MS?: number = 10_000;
}

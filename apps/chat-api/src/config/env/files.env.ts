import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** File upload/transfer, archive download/upload, publish-attachment and skill-upload limits. */
export class FilesEnv {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  FILE_UPLOAD_MAX_BYTES?: number = 536_870_912;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  FILE_TRANSFER_TIMEOUT_MS?: number = 30_000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_MAX_ITEMS?: number = 100;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_MAX_FILES?: number = 1000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_MAX_UNCOMPRESSED_BYTES?: number = 5_368_709_120;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_TIMEOUT_MS?: number = 300_000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(32)
  ARCHIVE_DOWNLOAD_CONCURRENCY?: number = 32;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_MAX_BYTES?: number = 536_870_912;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_MAX_FILES?: number = 1000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES?: number = 2_147_483_648;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_TIMEOUT_MS?: number = 300_000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  PUBLISH_ATTACHMENTS_MAX_FILES?: number = 1000;

  /*
   * Skills domain limits (see openspec/changes/archive/2026-08-13-fix-skill-editor-core-contract/design.md).
   * Defaults match DIAL Core's own real, verified `ComplexResourceService.Settings`
   * (maxFiles=100, maxFileSizeBytes=1 MiB, maxTotalBytes=16 MiB — read directly from
   * epam/ai-dial-core's source, not the epic issue's "~" approximations). There is no
   * `SKILL_UPLOAD_MAX_BYTES` (a compressed-ZIP Multer ingress cap): no ZIP is uploaded
   * on the create/update path, so such a cap has nothing to bound. A deployment that
   * still sets it has that value silently ignored
   * (class-transformer only maps decorated properties) rather than the boot failing.
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  SKILL_UPLOAD_MAX_FILES?: number = 100;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  SKILL_FILE_UPLOAD_MAX_BYTES?: number = 1_048_576;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  SKILL_UPLOAD_MAX_TOTAL_BYTES?: number = 16_777_216;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  SKILL_TRANSFER_TIMEOUT_MS?: number = 60_000;

  /*
   * Compressed-ZIP ingress cap for `POST /api/v1/skills/import` (see
   * openspec/changes/archive/2026-08-20-add-skill-archive-import/design.md D8). Distinct from
   * the retired `SKILL_UPLOAD_MAX_BYTES`: that variable capped a ZIP upload
   * on the create/update path, which no longer accepts ZIP at all; this one
   * bounds the new, additive archive-import endpoint's compressed upload
   * before extraction. Default (20 MiB) is deliberately larger than
   * `SKILL_UPLOAD_MAX_TOTAL_BYTES` (16 MiB decompressed) since ZIP container
   * overhead and poorly-compressible content (Markdown, scripts) mean the
   * compressed size can approach the uncompressed total.
   */
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  SKILL_ARCHIVE_UPLOAD_MAX_BYTES?: number = 20_971_520;
}

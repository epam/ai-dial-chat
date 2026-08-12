import { SkillResourceQueryDto } from './skill-resource-query.dto';

/**
 * Multipart form fields for `PUT /api/v1/skills` (whole-skill ZIP upload).
 * The binary `file` field is handled by `FileInterceptor`, not modeled here.
 * The optional `If-Match` request header is documented via
 * `ApiIfMatchHeader()` on the controller method and read directly off the
 * request, per `skill-file-path.dto.ts`'s header convention.
 */
export class UploadSkillDto extends SkillResourceQueryDto {}

import { CreateSkillDto } from './create-skill.dto';

/**
 * Multipart form fields for `PUT /api/v1/skills` (whole-skill update). Same
 * shape as `CreateSkillDto`; the `If-Match` request header (required for
 * this endpoint, unlike create) is documented via `ApiIfMatchHeader({
 * required: true })` on the controller method and read directly off the
 * request, per `skill-file-path.dto.ts`'s header convention.
 */
export class UpdateSkillDto extends CreateSkillDto {}

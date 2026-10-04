import { ApiProperty } from '@nestjs/swagger';

/**
 * Generic success envelope for GET /api/v1/custom-api/:operationId. `data` is
 * an opaque JSON value owned by the upstream Core operation — the BFF applies
 * no business schema or field filtering. The generated client's Raw method
 * exposes this field as `unknown`; the calling application owns domain
 * decoding and presentation. See
 * libs/chat-api-client/README.md and apps/chat/README.md.
 */
export class CustomApiResponseDto {
  /*
   * OpenAPI has no "any JSON value" primitive, so this is documented as a
   * free-form object (`type: 'object', additionalProperties: true`) even
   * though the real runtime value may also be an array, string, number,
   * boolean, or null — this is the documented generated-typing limitation
   * for an intentionally schema-less field. The generated TypeScript model
   * renders this as `{ [key: string]: unknown }` (postprocessed from the
   * generator's own `any` index signature by tools/openapi/postprocess-client.mjs);
   * the app adapter in apps/chat/src/server-api/custom-api.api.ts decodes the
   * whole envelope as `unknown` instead of trusting this shape.
   */
  @ApiProperty({
    description:
      'Opaque JSON value returned by the configured Core operation. Documented as a free-form object; the actual value may also be an array, string, number, boolean, or null — see the generated-typing note on this field.',
    type: 'object',
    additionalProperties: true,
    example: [
      {
        id: '1',
        display_name: 'Display name',
        description: 'some description',
      },
    ],
  })
  data!: unknown;
}

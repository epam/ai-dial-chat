import { ApiProperty } from '@nestjs/swagger';
import { PublishRuleDto } from './publish-rule.dto';

/** Response body for `GET /api/v1/publish/rules`. */
export class PublishRulesResultDto {
  @ApiProperty({
    description:
      "The requested folder's own access-restriction rules, or an empty array when the folder has none configured.",
    type: [PublishRuleDto],
  })
  rules!: PublishRuleDto[];
}

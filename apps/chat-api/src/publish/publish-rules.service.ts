import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { mapDialHttpStatus } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import type { PublishRuleDto } from './dto/publish-rule.dto';
import {
  getPublicTargetFolder,
  stripPublicTargetFolder,
} from './publish-target.util';

/**
 * Reads a destination folder's already-configured DIAL Core publication
 * rules, wrapping `getPublicationRules` (`POST /v1/ops/publication/rule/list`
 * under the hood) so the frontend can pre-fill the access-rules editor on
 * folder selection. Holds no persistence of its own — a pure pass-through
 * read, identical in spirit to `PublishService.publish`'s use of
 * `createPublication`.
 *
 * DIAL Core's response is ancestor-inclusive (every parent folder that has
 * rules of its own, keyed by path); this service discards every entry except
 * the exact requested `folderPath` match, since ancestor-rule
 * provenance/comparison is explicitly out of scope for this feature.
 */
@Injectable()
export class PublishRulesService {
  private readonly logger = new Logger(PublishRulesService.name);

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * @throws {BadGatewayException} When Core returns an unexpected error
   * @throws {ServiceUnavailableException} When Core is unreachable or times out
   */
  async getRules(
    accessToken: string,
    folderPath: string,
  ): Promise<PublishRuleDto[]> {
    const url = getPublicTargetFolder(folderPath);

    let result;
    try {
      result = await this.dialClient.client.getPublicationRules({
        headers: getBearerAuthHeaders(accessToken),
        body: { url },
      });
    } catch (err) {
      this.logger.error(
        `Unexpected error getting publish rules for "${folderPath}"`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new BadGatewayException('Failed to reach DIAL Core');
    }

    if (result.error) {
      return mapDialHttpStatus(
        result.response.status,
        `get publish rules for "${folderPath}"`,
        this.logger,
      );
    }

    const rulesByFolder = result.data?.rules ?? {};
    const matchingEntry = Object.entries(rulesByFolder).find(
      ([key]) => stripPublicTargetFolder(key) === folderPath,
    );

    return (matchingEntry?.[1] ?? []) as PublishRuleDto[];
  }
}

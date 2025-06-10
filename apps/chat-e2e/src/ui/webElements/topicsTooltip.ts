import { MarketplaceAgentSelectors } from '@/src/ui/selectors';
import { Tooltip } from '@/src/ui/webElements/tooltip';

export class TopicsTooltip extends Tooltip {
  public topic = this.getChildElementBySelector(
    MarketplaceAgentSelectors.topic,
  );
}

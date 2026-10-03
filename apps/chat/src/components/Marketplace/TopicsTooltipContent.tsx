import { ShrinkWrappedTooltipContent } from '@/src/components/Common/ShrinkWrappedTooltipContent';
import { MarketplaceEntityTopic } from '@/src/components/Marketplace/MarketplaceEntityTopic';

const MAX_WIDTH = 192;

interface Props {
  topics: string[];
}

export const TopicsTooltipContent = ({ topics }: Props) => (
  <ShrinkWrappedTooltipContent maxWidth={MAX_WIDTH}>
    {topics.map((topic) => (
      <MarketplaceEntityTopic
        key={topic}
        topic={topic}
        maxWidth={MAX_WIDTH}
        hideTooltip
      />
    ))}
  </ShrinkWrappedTooltipContent>
);

import { CSSProperties, FC } from 'react';
import { UsageLimitCardGroupProps } from '../../models/usage-limit-card-props';
import { UsageLimitCard } from '../UsageLimitCard/UsageLimitCard';

/** Renders each card as its own independent, equally-sized box: stacked on mobile, side by side on desktop. Renders nothing when `cards` is empty. */
export const UsageLimitCardGroup: FC<UsageLimitCardGroupProps> = ({
  cards,
  labels,
  styles: stylesProp,
}) => {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div
      className="grid grid-cols-1 gap-4 desktop:grid-cols-[repeat(var(--uld-card-count),minmax(0,1fr))]"
      style={{ '--uld-card-count': cards.length } as CSSProperties}
    >
      {cards.map((card) => (
        <UsageLimitCard
          key={card.title}
          data={card}
          labels={labels}
          styles={stylesProp}
        />
      ))}
    </div>
  );
};

import { memo, type FC } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useCelebration } from '../../context/CelebrationContext';

/** A single start-page slot for every event's decoration and trigger. */
const CelebrationDecor: FC = () => {
  const { event, activate } = useCelebration();
  if (!event) return null;
  const Decoration = event.Decoration;
  return (
    <ErrorBoundary key={event.id} fallback={null}>
      <Decoration onActivate={activate} />
    </ErrorBoundary>
  );
};

export default memo(CelebrationDecor);

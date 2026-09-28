import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { CELEBRATIONS_CLASS } from '../../constants/public-class-names';
import { useCelebration } from '../../context/CelebrationContext';

/** Start-page slot rendering the active event's decoration and trigger. */
const CelebrationDecorComponent: FC = () => {
  const { event, activate } = useCelebration();
  if (!event) return null;
  const Decoration = event.Decoration;
  return (
    <ErrorBoundary key={event.id} fallback={null}>
      {/* `contents` keeps the wrapper out of the host's flex layout. */}
      <div className={mergeClasses('contents', CELEBRATIONS_CLASS.decor)}>
        <Decoration onActivate={activate} />
      </div>
    </ErrorBoundary>
  );
};

/** Start-page slot rendering the active event's decoration and trigger. */
export const CelebrationDecor = memo(CelebrationDecorComponent);

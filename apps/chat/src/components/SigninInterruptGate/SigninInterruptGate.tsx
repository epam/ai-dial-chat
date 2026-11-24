import { lazy, memo, Suspense, type FC } from 'react';
import { useClientChannel } from '../../context/ClientChannelContext';
import { useDeferredOverlayMount } from '../../hooks/useDeferredOverlayMount';

const SigninInterruptDialog = lazy(
  () => import('../SigninInterruptDialog/SigninInterruptDialog'),
);

/**
 * Mounts the sign-in interrupt dialog after the page has loaded, or as soon as
 * a sign-in event is pending if that comes first. The dialog renders nothing
 * without events, and mounting its `lazy()` boundary at page load would fetch
 * its chunk during first paint. A separate component, so client-channel
 * updates re-render only this gate, never `App`.
 */
const SigninInterruptGate: FC = () => {
  const { pendingEvents } = useClientChannel();
  const isMounted = useDeferredOverlayMount(pendingEvents.length > 0);

  if (!isMounted) return null;

  return (
    <Suspense fallback={null}>
      <SigninInterruptDialog />
    </Suspense>
  );
};

export default memo(SigninInterruptGate);

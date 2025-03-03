import { useEffect } from 'react';

/**
 * Hook to synchronize horizontal scrolling between two elements
 * @param firstRef - reference to the first scrolling element
 * @param secondRef - reference to the second scrolling element
 */

export const useSyncXScroll = (
  firstRef: React.RefObject<HTMLElement> | null,
  secondRef: React.RefObject<HTMLElement> | null,
) => {
  useEffect(() => {
    const firstElement = firstRef?.current;
    const secondElement = secondRef?.current;

    if (!firstElement || !secondElement) return;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      return () => {
        target.scrollLeft = source.scrollLeft;
      };
    };

    const handleSourceScroll = syncScroll(firstElement, secondElement);
    const handleTargetScroll = syncScroll(secondElement, firstElement);

    firstElement.addEventListener('scroll', handleSourceScroll);
    secondElement.addEventListener('scroll', handleTargetScroll);

    return () => {
      firstElement.removeEventListener('scroll', handleSourceScroll);
      secondElement.removeEventListener('scroll', handleTargetScroll);
    };
  }, [firstRef, secondRef]);
};

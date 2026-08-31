'use client';

import { ChatOverlay, ChatOverlayOptions } from '@epam/ai-dial-overlay';
import { FC, useEffect, useRef } from 'react';

interface ChatOverlayFullWidthWrapperProps {
  overlayOptions: Omit<ChatOverlayOptions, 'hostDomain'>;
}

// A minimal host wrapper whose container tracks the browser viewport width,
// unlike ChatOverlayWrapper's fixed 500x700 box - needed to test the sidebar
// overlay breakpoint (768px/1280px), which reacts to the iframe's own
// rendered width rather than requiring native fullscreen.
export const ChatOverlayFullWidthWrapper: FC<
  ChatOverlayFullWidthWrapperProps
> = ({ overlayOptions }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlay = useRef<ChatOverlay | null>(null);

  useEffect(() => {
    if (!overlay.current && containerRef.current) {
      overlay.current = new ChatOverlay(containerRef.current, {
        ...overlayOptions,
        hostDomain: window.location.origin,
      });
    }
  }, [overlayOptions]);

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
};

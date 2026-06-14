import { SidebarPanel, type SidebarPanelProps } from '@epam/ai-dial-sidebar';
import { memo, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import useViewportWidth from '../../hooks/use-viewport-width';
import useLocalStorage from '../../hooks/useLocalStorage';

const MIN_WIDTH = 312;
const DEFAULT_WIDTH = 360;

interface Props extends SidebarPanelProps {
  storageKey: string;
  minWidth?: number;
  defaultWidth?: number;
}

const ResizableSidebarPanel: FC<Props> = ({
  storageKey,
  minWidth = MIN_WIDTH,
  defaultWidth: initialDefaultWidth = DEFAULT_WIDTH,
  ...sidebarPanelProps
}) => {
  const isMobile = useIsMobile();
  const viewportWidth = useViewportWidth();
  const maxWidth = Math.floor(viewportWidth * 0.5);

  const [storedWidth, setStoredWidth] = useLocalStorage(
    storageKey,
    initialDefaultWidth,
  );
  const clampedDefaultWidth = Math.min(
    Math.max(storedWidth, minWidth),
    maxWidth,
  );

  return (
    <SidebarPanel
      {...sidebarPanelProps}
      resizable={!isMobile}
      defaultWidth={clampedDefaultWidth}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onResizeStop={setStoredWidth}
    />
  );
};

export default memo(ResizableSidebarPanel);

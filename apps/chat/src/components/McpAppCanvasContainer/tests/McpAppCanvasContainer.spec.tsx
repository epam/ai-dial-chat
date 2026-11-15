import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import McpAppCanvasContainer from '../McpAppCanvasContainer';

const containerSpy = vi.fn();
const hostAdapterSpy = vi.fn();

vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  AttachmentCanvasContainer: (props: unknown) => {
    containerSpy(props);
    return null;
  },
}));

vi.mock('../../../hooks/attachment/useMcpAppHostAdapter', () => ({
  useMcpAppHostAdapter: (displayMode: string) => hostAdapterSpy(displayMode),
}));

describe('McpAppCanvasContainer', () => {
  beforeEach(() => {
    containerSpy.mockClear();
    hostAdapterSpy.mockReset();
  });

  it('passes the live fullscreen host context and forwards the other props', () => {
    const hostContext = { theme: 'dark' };
    hostAdapterSpy.mockReturnValue({ hostContext });

    render(<McpAppCanvasContainer isMobile />);

    expect(hostAdapterSpy).toHaveBeenCalledWith('fullscreen');
    expect(containerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isMobile: true,
        mcpAppHostContext: hostContext,
      }),
    );
  });

  it('hands over the new host context when the theme changes', () => {
    hostAdapterSpy.mockReturnValue({ hostContext: { theme: 'dark' } });
    const { rerender } = render(<McpAppCanvasContainer />);

    hostAdapterSpy.mockReturnValue({ hostContext: { theme: 'light' } });
    rerender(<McpAppCanvasContainer isMobile={false} />);

    expect(containerSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ mcpAppHostContext: { theme: 'light' } }),
    );
  });
});

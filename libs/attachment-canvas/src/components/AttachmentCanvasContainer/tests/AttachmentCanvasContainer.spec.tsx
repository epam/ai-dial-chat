import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentCanvasProvider } from '../../../context/AttachmentCanvasContext';
import { AttachmentCanvasContainer } from '../AttachmentCanvasContainer';

const capturedCanvasProps: {
  current: {
    defaultWidth?: number;
    minWidth?: number;
    maxWidth?: number;
  } | null;
} = { current: null };

vi.mock('../../AttachmentCanvas/AttachmentCanvas', () => ({
  AttachmentCanvas: (props: {
    defaultWidth?: number;
    minWidth?: number;
    maxWidth?: number;
  }) => {
    capturedCanvasProps.current = props;
    return null;
  },
}));

const renderContainer = (
  props?: Partial<React.ComponentProps<typeof AttachmentCanvasContainer>>,
) =>
  render(
    <AttachmentCanvasProvider>
      <AttachmentCanvasContainer {...props} />
    </AttachmentCanvasProvider>,
  );

describe('AttachmentCanvasContainer', () => {
  beforeEach(() => {
    capturedCanvasProps.current = null;
  });

  it('forwards defaultWidth, minWidth and maxWidth to the canvas', () => {
    renderContainer({ defaultWidth: 480, minWidth: 400, maxWidth: 640 });
    expect(capturedCanvasProps.current).toMatchObject({
      defaultWidth: 480,
      minWidth: 400,
      maxWidth: 640,
    });
  });

  it('leaves minWidth undefined so the canvas keeps its own minimum', () => {
    renderContainer();
    expect(capturedCanvasProps.current?.minWidth).toBeUndefined();
  });
});

import {
  AttachmentCanvasContainer,
  type AttachmentCanvasContainerProps,
} from '@epam/ai-dial-attachment-canvas';
import { memo, type FC } from 'react';
import { useMcpAppHostAdapter } from '../../hooks/attachment/useMcpAppHostAdapter';

type Props = Omit<AttachmentCanvasContainerProps, 'mcpAppHostContext'>;

/** Attachment canvas container that feeds an open MCP App the live host context, so theme and locale changes reach it. */
const McpAppCanvasContainer: FC<Props> = (props) => {
  const { hostContext } = useMcpAppHostAdapter('fullscreen');

  return (
    <AttachmentCanvasContainer {...props} mcpAppHostContext={hostContext} />
  );
};

export default memo(McpAppCanvasContainer);

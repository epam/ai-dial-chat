import { ScreenState } from '@/src/types/common';

import { FooterMessage } from '../../Common/FooterMessage';
import { withRenderForScreen } from '../../Common/ScreenRender';

function ChatInputFooterView() {
  return (
    <div className="p-5 max-md:hidden">
      <FooterMessage />
    </div>
  );
}

export const ChatInputFooter = withRenderForScreen([
  ScreenState.MD,
  ScreenState.XL,
  ScreenState.XL3,
  ScreenState.XL4,
  ScreenState.XL5,
])(ChatInputFooterView);

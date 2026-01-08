import { ScreenState } from '@/src/types/common';

import { FooterMessage } from '@/src/components/Common/FooterMessage';
import { withRenderForScreen } from '@/src/components/Common/ScreenRender';

function ChatInputFooterView() {
  return (
    <div className="px-5 pb-5 empty:hidden max-md:hidden">
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

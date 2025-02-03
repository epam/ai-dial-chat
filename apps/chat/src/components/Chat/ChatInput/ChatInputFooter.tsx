import { useScreenState } from '@/src/hooks/useScreenState';

import { ScreenState } from '@/src/types/common';

import { FooterMessage } from '../../Common/FooterMessage';

export const ChatInputFooter = () => {
  const screenState = useScreenState();
  if (screenState === ScreenState.MOBILE) return null;
  return (
    <div className="p-5 max-md:hidden">
      <FooterMessage />
    </div>
  );
};

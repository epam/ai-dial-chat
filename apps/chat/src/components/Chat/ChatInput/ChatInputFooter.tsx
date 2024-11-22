import { FooterMessage } from '../../Common/FooterMessage';

export const ChatInputFooter = () => {
  return (
    <div className="absolute bottom-0 w-full p-5 max-md:hidden">
      <FooterMessage />
    </div>
  );
};

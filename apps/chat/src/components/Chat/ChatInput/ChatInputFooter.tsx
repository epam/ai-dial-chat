import classNames from 'classnames';

import { FooterMessage } from '../../Common/FooterMessage';

interface Props {
  absolute?: boolean;
}

export const ChatInputFooter = ({ absolute }: Props) => {
  return (
    <div
      className={classNames(
        'p-5 max-md:hidden',
        absolute && 'absolute bottom-0 w-full',
      )}
    >
      <FooterMessage />
    </div>
  );
};

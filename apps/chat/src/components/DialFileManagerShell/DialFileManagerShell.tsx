import type { UseDialFileManagerResult } from '@epam/ai-dial-chat-hooks';
import {
  DialFileManagerShell as SharedDialFileManagerShell,
  type DialFileManagerShellProps,
} from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';

type Props = Omit<DialFileManagerShellProps, 'controller'> & {
  hookResult: UseDialFileManagerResult;
};

const DialFileManagerShell: FC<Props> = ({ hookResult, ...rest }) => (
  <SharedDialFileManagerShell controller={hookResult} {...rest} />
);

export default memo(DialFileManagerShell);

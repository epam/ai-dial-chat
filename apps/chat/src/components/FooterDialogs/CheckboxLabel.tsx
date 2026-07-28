import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import RequiredMark from './RequiredMark';

interface Props {
  children: ReactNode;
}

const CheckboxLabel: FC<Props> = ({ children }) => (
  <span className="dial-small-text pl-2 text-primary">
    {children}
    <RequiredMark />
  </span>
);

export default memo(CheckboxLabel);

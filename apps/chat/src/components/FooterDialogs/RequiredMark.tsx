import type { FC } from 'react';
import { memo } from 'react';

const RequiredMark: FC = () => (
  <span className="ms-0.5 text-accent" aria-hidden>
    *
  </span>
);

export default memo(RequiredMark);

import { FocusEvent } from 'react';

export const onBlur = (e: FocusEvent) => {
  e.target.classList.add('submitted', 'input-invalid');
};

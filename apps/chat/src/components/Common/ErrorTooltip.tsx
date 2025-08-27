import { IconExclamationCircle } from '@tabler/icons-react';

import classNames from 'classnames';

import { Tooltip, TooltipOptions } from './Tooltip';

export function ErrorTooltip(props: Omit<TooltipOptions, 'children'>) {
  return (
    <Tooltip
      {...props}
      contentClassName={classNames('text-error', props.contentClassName)}
    >
      <IconExclamationCircle
        size={14}
        className={classNames(
          'shrink-0 text-error',
          props.hideTooltip && 'hidden',
        )}
      />
    </Tooltip>
  );
}

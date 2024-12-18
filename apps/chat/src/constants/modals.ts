import { UseDismissProps } from '@floating-ui/react';

export const MOUSE_OUTSIDE_PRESS_EVENT: Pick<
  UseDismissProps,
  'outsidePressEvent'
> = { outsidePressEvent: 'mousedown' };

export const OUTSIDE_PRESS: Pick<UseDismissProps, 'outsidePress'> = {
  outsidePress: true,
};

export const OUTSIDE_PRESS_AND_MOUSE_EVENT = {
  ...MOUSE_OUTSIDE_PRESS_EVENT,
  ...OUTSIDE_PRESS,
};

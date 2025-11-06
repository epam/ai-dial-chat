import { UseDismissProps } from '@floating-ui/react';

export const MOUSE_OUTSIDE_PRESS_EVENT: Pick<
  UseDismissProps,
  'outsidePressEvent'
> = { outsidePressEvent: 'mousedown' };

export const OUTSIDE_PRESS: Pick<UseDismissProps, 'outsidePress'> = {
  outsidePress: true,
};

export const DISALLOW_OUTSIDE_PRESS: Pick<UseDismissProps, 'outsidePress'> = {
  outsidePress: false,
};

export const ESCAPE_KEY_PRESS: Pick<UseDismissProps, 'escapeKey'> = {
  escapeKey: true,
};

export const DISALLOW_ESCAPE_KEY_PRESS: Pick<UseDismissProps, 'escapeKey'> = {
  escapeKey: false,
};

export const OUTSIDE_PRESS_AND_MOUSE_EVENT = {
  ...MOUSE_OUTSIDE_PRESS_EVENT,
  ...OUTSIDE_PRESS,
};

export const DISALLOW_INTERACTIONS = {
  ...DISALLOW_OUTSIDE_PRESS,
  ...DISALLOW_ESCAPE_KEY_PRESS,
};

import { UseDismissProps } from '@floating-ui/react';

export const ALLOW_CLICK_OUTSIDE = {
  outsidePress: true,
  escapeKey: true,
} as UseDismissProps;

export const DISALLOW_CLICK_OUTSIDE = {
  outsidePress: false,
  escapeKey: false,
} as UseDismissProps;

import { ComponentType, forwardRef } from 'react';

import Tooltip from '@/src/components/Common/Tooltip';

interface TooltipWrapperProps {
  tooltip?: string;
}

export function TooltipWrapper<T extends object, R>(
  Component: ComponentType<T>,
) {
  const EnhancedComponent = forwardRef<R, TooltipWrapperProps & T>(
    ({ tooltip, ...props }, ref) => (
      <div>
        {tooltip && (
          <Tooltip tooltip={tooltip} placement="top">
            <Component {...(props as T)} ref={ref} />
          </Tooltip>
        )}
        {!tooltip && <Component {...(props as T)} ref={ref} />}
      </div>
    ),
  );

  EnhancedComponent.displayName = 'TooltipWrapper';

  return EnhancedComponent;
}

import { ComponentType, ReactNode } from 'react';

import { useAppSelector } from '@/src/store/hooks';

import { RootState } from '@/src/store';

interface RenderWhenProps {
  children: ReactNode;
  selector: (state: RootState) => unknown;
}

export function RenderWhen({ selector, children }: RenderWhenProps) {
  const shouldRender = useAppSelector(selector);
  return shouldRender ? children : null;
}

export function getComponentDisplayName<T extends object>(
  WrappedComponent: ComponentType<T>,
) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

export function withRenderWhen(selector: (state: RootState) => unknown) {
  return function <T extends object>(WrappedComponent: ComponentType<T>) {
    const ComponentWithRenderWhen = (props: T) => {
      const shouldRender = useAppSelector(selector);
      return shouldRender ? <WrappedComponent {...props} /> : null;
    };

    ComponentWithRenderWhen.displayName = `withRenderWhen(${getComponentDisplayName(WrappedComponent)})`;

    return ComponentWithRenderWhen;
  };
}

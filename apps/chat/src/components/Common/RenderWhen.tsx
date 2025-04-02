import { ComponentType } from 'react';

import { RootState } from '@/src/types/store';

import { useAppSelector } from '@/src/store/hooks';

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

export function withRenderWhenNot(selector: (state: RootState) => unknown) {
  return function <T extends object>(WrappedComponent: ComponentType<T>) {
    const ComponentWithRenderWhenNot = (props: T) => {
      const shouldRender = !useAppSelector(selector);
      return shouldRender ? <WrappedComponent {...props} /> : null;
    };

    ComponentWithRenderWhenNot.displayName = `withRenderWhenNot(${getComponentDisplayName(WrappedComponent)})`;

    return ComponentWithRenderWhenNot;
  };
}

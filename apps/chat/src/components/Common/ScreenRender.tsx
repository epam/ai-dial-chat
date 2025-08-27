import { ComponentType } from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';

import { ScreenState } from '@/src/types/common';

import { getComponentDisplayName } from './RenderWhen';

export function withRenderForScreen(screenStates: ScreenState[]) {
  return function <T extends object>(WrappedComponent: ComponentType<T>) {
    const ComponentWithRenderForScreen = (props: T) => {
      const screenState = useScreenState();
      return screenStates.includes(screenState) ? (
        <WrappedComponent {...props} />
      ) : null;
    };

    ComponentWithRenderForScreen.displayName = `withRenderForScreen(${getComponentDisplayName(WrappedComponent)})`;

    return ComponentWithRenderForScreen;
  };
}

import { ComponentType } from 'react';

import { createSelector } from '@reduxjs/toolkit';

import { RootState } from '@/src/types/store';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { Feature } from '@epam/ai-dial-shared';

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

export function withRenderWhenFeature(feature: Feature) {
  return function <T extends object>(WrappedComponent: ComponentType<T>) {
    const ComponentWithRenderWhen = (props: T) => {
      const shouldRender = useAppSelector((state) =>
        SettingsSelectors.isFeatureEnabled(state, feature),
      );
      return shouldRender ? <WrappedComponent {...props} /> : null;
    };

    ComponentWithRenderWhen.displayName = `withRenderWhenFeature(${getComponentDisplayName(WrappedComponent)})`;

    return ComponentWithRenderWhen;
  };
}

export function withRenderWhenEntities<T extends object>(
  propsMap: Record<keyof T, (state: RootState) => T[keyof T] | undefined>,
) {
  const propsMapEntries = Object.entries(propsMap) as [
    keyof T,
    (state: RootState) => T[keyof T] | undefined,
  ][];

  const selector = createSelector(
    propsMapEntries.map(([, s]) => s),
    (...selectorResults) => {
      return propsMapEntries.reduce<
        Partial<Record<keyof T, T[keyof T] | undefined>>
      >((acc, [key], i) => {
        acc[key] = selectorResults[i];
        return acc;
      }, {});
    },
  );

  return (Component: ComponentType<T>) => {
    const Wrapper = (props: T) => {
      const entityProps = useAppSelector(selector);

      if (
        Object.values(entityProps).some((v) => v === undefined || v === null)
      ) {
        return null;
      }

      return (
        <Component
          {...props}
          {...(entityProps as Record<keyof T, T[keyof T]>)}
        />
      );
    };

    Wrapper.displayName = `withRenderWhenEntities(${getComponentDisplayName(Component)})`;
    return Wrapper;
  };
}

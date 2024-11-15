import Inversify from './Inversify';

import { FC } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

const TestComponent: FC<{ message: string }> = ({ message }) => {
  return <div>{message}</div>;
};

describe('Inversify', () => {
  beforeEach(() => {
    Inversify['container'] = new WeakMap();
  });

  it('should register a component and return it with original reference', () => {
    const RegisteredComponent = Inversify.register(
      'TestComponent',
      TestComponent,
    );

    expect(RegisteredComponent.original).toBe(TestComponent);
    expect(RegisteredComponent.name).toBe('TestComponent');
  });

  it('should resolve a component and return a instance function', () => {
    const ResolvedComponent = Inversify.resolve(TestComponent);

    expect(ResolvedComponent.instance()).toBe(TestComponent);
  });

  it('should resolve a component and return a render function', () => {
    const RenderedComponent = Inversify.resolve(TestComponent).render();

    expect(RenderedComponent.original).toBe(TestComponent);
  });

  it('should bind a new implementation to a component', () => {
    const NewComponent: FC<{ message: string }> = ({ message }) => {
      return <span>{message}</span>;
    };

    Inversify.resolve(TestComponent).bind(() => NewComponent);
    const BoundComponent = Inversify.resolve(TestComponent).instance();

    expect(BoundComponent).toBe(NewComponent);
  });

  it('should bind and unbind an implementation of a component', () => {
    const NewComponent: FC<{ message: string }> = ({ message }) => {
      return <span>{message}</span>;
    };

    Inversify.resolve(TestComponent).bind(() => NewComponent);
    const BoundComponent = Inversify.resolve(TestComponent).instance();

    expect(BoundComponent).toBe(NewComponent);

    Inversify.resolve(TestComponent).unbind();

    expect(Inversify.resolve(TestComponent).instance()).toBe(TestComponent);
  });

  it('should render the bound implementation', () => {
    const NewComponent: FC<{ message: string }> = ({ message }) => {
      return <span>{message}</span>;
    };

    Inversify.resolve(TestComponent).bind(() => NewComponent);
    const RenderedComponent = Inversify.resolve(TestComponent).render();

    expect(RenderedComponent.name).toBe('TestComponent');
    expect(RenderedComponent.original).toBe(TestComponent);
  });
});

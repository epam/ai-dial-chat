import { FC } from 'react';

interface ComponentResolve<P extends object> {
  instance: () => FC<P> | undefined;
  bind: (
    componentFactory: (component: FC<P>) => FC<P>,
  ) => FC<P>;
  unbind: () => void;
  render: () => FC<P> & { original: FC<P> };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = FC<any>;

export class Inversify {
  private static container = new WeakMap<
    AnyComponent,
    AnyComponent
  >();

  public static register<P extends object>(
    name: string,
    component: FC<P>,
  ): FC<P> & { original: FC<P> } {
    try {
      if (!component.name) {
        Object.defineProperty(component, 'name', {
          value: name,
          writable: false,
          configurable: true,
          enumerable: false,
        });
      }

      return Inversify.resolve(component).render();
    } catch {
      return component as unknown as FC<P> & {
        original: FC<P>;
      };
    }
  }

  public static resolve<P extends object>(
    component: FC<P>,
  ): ComponentResolve<P> {
    if (component && !Inversify.container.has(component)) {
      Inversify.container.set(component, component);
    }

    return {
      instance: () => Inversify.container.get(component),
      bind: (
        componentFactory,
      ) => Inversify.bindImplementation(component, componentFactory),
      unbind: () => Inversify.container.set(component, component),
      render: () => Inversify.renderImplementation(component),
    };
  }

  private static bindImplementation<P extends object>(
    component: FC<P>,
    componentFactory: (component: FC<P>) => FC<P>,
  ): FC<P> {
    const newComponent = componentFactory(component);
    Inversify.container.set(component, newComponent);
    return newComponent;
  }

  private static renderImplementation<P extends object>(
    component: FC<P>,
  ): FC<P> & { original: FC<P> } {
    const renderedComponent = (props: P) => {
      const ResolvedComponent = (Inversify.container.get(component) ?? component);

      return <ResolvedComponent {...props} />;
    };

    Object.defineProperties(renderedComponent, {
      name: {
        value: component.name,
        writable: false,
        configurable: true,
        enumerable: false,
      },
      original: {
        value: component,
        writable: false,
        configurable: true,
        enumerable: false,
      },
    });

    return renderedComponent as FC<P> & { original: FC<P> };
  }
}

export default Inversify;

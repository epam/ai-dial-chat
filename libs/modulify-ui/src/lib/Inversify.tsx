import { FC, PropsWithChildren } from 'react';

type ComponentProps<P> =
  P extends FC<infer Props> ? PropsWithChildren<Props> : never;

// TODO: replace any, use narrow typings
type OriginalComponent<P extends NonNullable<any> = NonNullable<any>> = FC<
  PropsWithChildren<P>
>;

type ComponentImplementation<OC extends OriginalComponent> = FC<
  ComponentProps<OC>
>;

interface ComponentResolve<OC extends OriginalComponent> {
  instance: () => ComponentImplementation<OC> | undefined;
  bind: (
    componentFactory: (component: OC) => ComponentImplementation<OC>,
  ) => ComponentImplementation<OC>;
  unbind: () => void;
  render: () => ComponentImplementation<OC> & { original: OC };
}

export class Inversify {
  private static container = new WeakMap<
    OriginalComponent,
    ComponentImplementation<OriginalComponent>
  >();

  public static register<OC extends OriginalComponent>(
    name: string,
    component: OC,
  ): ComponentImplementation<OC> & { original: OC } {
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
      return component as unknown as ComponentImplementation<OC> & {
        original: OC;
      };
    }
  }

  public static resolve<OC extends OriginalComponent>(
    component: OC,
  ): ComponentResolve<OC> {
    if (component && !Inversify.container.has(component)) {
      Inversify.container.set(component, component);
    }

    return {
      instance: () => Inversify.container.get(component),
      bind: (
        componentFactory: (component: OC) => ComponentImplementation<OC>,
      ) => Inversify.bindImplementation(component, componentFactory),
      unbind: () => Inversify.container.set(component, component),
      render: () => Inversify.renderImplementation(component),
    };
  }

  private static bindImplementation<OC extends OriginalComponent>(
    component: OC,
    componentFactory: (component: OC) => ComponentImplementation<OC>,
  ): ComponentImplementation<OC> {
    const newComponent = componentFactory(component);
    Inversify.container.set(component, newComponent as OC);
    return newComponent;
  }

  private static renderImplementation<OC extends OriginalComponent>(
    component: OC,
  ): ComponentImplementation<OC> & { original: OC } {
    const renderedComponent = (props: ComponentProps<OC>) => {
      const ResolvedComponent = Inversify.container.get(component) ?? component;

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

    return renderedComponent as ComponentImplementation<OC> & { original: OC };
  }
}

export default Inversify;

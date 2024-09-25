import { FC, PropsWithChildren } from 'react';

type ComponentProps<P> =
  P extends FC<infer Props> ? PropsWithChildren<Props> : never;
type OriginalComponent<P extends NonNullable<unknown> = NonNullable<unknown>> =
  FC<PropsWithChildren<P>>;
type ComponentImplementation<OC extends OriginalComponent> = FC<
  ComponentProps<OC>
>;

const container = new WeakMap<
  OriginalComponent,
  ComponentImplementation<OriginalComponent>
>();

function register<OC extends OriginalComponent>(
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

    return resolve(component).render();
  } catch (e) {
    console.error(e);

    return component as unknown as ComponentImplementation<OC> & {
      original: OC;
    };
  }
}

function resolve<OC extends OriginalComponent>(
  component: OC,
): {
  instance: () => ComponentImplementation<OC> | undefined;
  bind: (
    componentFactory: (component: OC) => ComponentImplementation<OC>,
  ) => ComponentImplementation<OC>;
  render: () => ComponentImplementation<OC> & { original: OC };
} {
  if (component && !container.has(component)) {
    container.set(component, component);
  }

  return {
    instance: () => getInstance(component),
    bind: (componentFactory: (component: OC) => ComponentImplementation<OC>) =>
      bindImplementation(component, componentFactory),
    render: () => renderImplementation(component),
  };
}

function getInstance<OC extends OriginalComponent>(
  component: OC,
): ComponentImplementation<OC> | undefined {
  return container.get(component) as ComponentImplementation<OC> | undefined;
}

function bindImplementation<OC extends OriginalComponent>(
  component: OC,
  componentFactory: (component: OC) => ComponentImplementation<OC>,
): ComponentImplementation<OC> {
  const newComponent = componentFactory(component);
  container.set(component, newComponent as OC);

  return newComponent;
}

function renderImplementation<OC extends OriginalComponent>(
  component: OC,
): ComponentImplementation<OC> & { original: OC } {
  const renderedComponent = (props: ComponentProps<OC>) => {
    const ResolvedComponent = container.get(component) ?? component;

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

export const Inversify = {
  register,
  resolve,
};

export default Inversify;

import {
  Children,
  DependencyList,
  Dispatch,
  EffectCallback,
  FC,
  Fragment,
  HTMLAttributes,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  SetStateAction,
  cloneElement,
  createElement,
  isValidElement,
  memo,
  useEffect,
  useState,
} from 'react';
import { Styles, createGenerateId, createUseStyles } from 'react-jss';

export const DATA_CUSTOMIZE_ID = 'data-customize-id';

export type CB_State = Record<string, unknown>;
export type CB_StateFn = (
  state: CB_State,
  setState: Dispatch<SetStateAction<CB_State>>,
) => void;

export interface CB_Styles {
  host?: Styles;
  component?: Styles;
}
export type CB_StylesFn = (state?: CB_State) => CB_Styles;

export interface CB_ClassNames {
  host?: string | string[];
  component?: string | string[];
}
export type CB_ClassNamesFn = (state?: CB_State) => CB_ClassNames;

export interface CB_Effect {
  effect: EffectCallback;
  dependencies: DependencyList;
}
export type CB_EffectsFn = (
  state?: CB_State,
  setState?: Dispatch<SetStateAction<CB_State>>,
) => CB_Effect[];

type CB_HostHandlers = Record<string, (...args: unknown[]) => unknown>;
type CB_ComponentHandlers = Record<string, (...args: unknown[]) => unknown>;
export interface CB_Handlers {
  host?: CB_HostHandlers;
  component?: CB_ComponentHandlers;
}
export type CB_HandlersFn = (
  state?: CB_State,
  setState?: Dispatch<SetStateAction<CB_State>>,
) => CB_Handlers;

export type CB_HTMLContentFn = (
  children?: ReactNode | ReactNode[],
  state?: CB_State,
  handlers?: CB_Handlers['component'],
) => ReactNode;

type ComponentProps<P> =
  P extends FC<infer Props> ? PropsWithChildren<Props> : never;

export class ComponentBuilder<
  Component extends FC<PropsWithChildren<any>>,
  BlockIds extends string,
  Props extends ComponentProps<Component> = ComponentProps<Component>,
> {
  private htmlReplacements: Partial<Record<BlockIds, CB_HTMLContentFn>> = {};

  private constructor(component: Component) {
    this.baseComponent = component;
  }

  static use<
    Component extends FC<PropsWithChildren<any>>,
    BlockIds extends string = '',
  >(component: Component) {
    return new ComponentBuilder<Component, BlockIds>(component);
  }

  updateClassNames(
    updateFn: (classNames: CB_ClassNames, state?: CB_State) => CB_ClassNames,
  ) {
    if (typeof updateFn === 'function') {
      const prevClassNamesFn = this.classNamesFn;
      this.classNamesFn = (state) => updateFn(prevClassNamesFn(state), state);
    }
    return this;
  }

  updateStyles(updateFn: (css: CB_Styles, state?: CB_State) => CB_Styles) {
    if (typeof updateFn === 'function') {
      const prevStylesFn = this.stylesFn;
      this.stylesFn = (state) => updateFn(prevStylesFn(state), state);
    }
    return this;
  }

  updateHTML(
    htmlContentFnOrBlocks:
      | CB_HTMLContentFn
      | Partial<Record<BlockIds, CB_HTMLContentFn>>,
  ) {
    if (typeof htmlContentFnOrBlocks === 'function') {
      this.htmlContentFn = htmlContentFnOrBlocks;
    } else {
      this.htmlReplacements = htmlContentFnOrBlocks;
      this.htmlContentFn = ((
        children: ReactNode,
        state: CB_State,
        handlers: CB_ComponentHandlers,
      ) => {
        return this.applyHTMLReplacements(children, state, handlers);
      }) as CB_HTMLContentFn;
    }
    return this;
  }

  updateHandlers(
    updateFn: (
      handlers: CB_Handlers,
      state?: CB_State,
      setState?: Dispatch<SetStateAction<CB_State>>,
    ) => CB_Handlers,
  ) {
    if (typeof updateFn === 'function') {
      const prevHandlersFn = this.handlersFn;
      this.handlersFn = (state, setState) =>
        updateFn(prevHandlersFn(state, setState), state, setState);
    }
    return this;
  }

  addState(stateFn: CB_StateFn) {
    this.stateFn = stateFn;
    return this;
  }

  addEffects(effectsFn: CB_EffectsFn) {
    this.effectsFn = effectsFn;
    return this;
  }

  build(options: { reactMemo?: boolean } = {}) {
    const Component = (props: Props) => {
      const [componentState, setComponentState] = useState<CB_State>({});
      const classNames = this.useClassNames(componentState);
      const handlers = this.useHandlers(componentState, setComponentState);
      const css = this.useStyles(componentState, this.baseComponent.name);
      const composeClassNames = (...classNames: (string | string[])[]) =>
        classNames.flat().join(' ').trim();
      const composedHostClassNames = composeClassNames(
        classNames.host ?? [],
        css.host ?? '',
      );
      const composedComponentClassNames = composeClassNames(
        classNames.component ?? [],
        css.component ?? '',
      );

      useEffect(() => {
        this.stateFn?.(componentState, setComponentState);
      }, [this.stateFn]);

      this.useEffectsRunner(this.effectsFn, componentState, setComponentState);

      const reactElement: ReactElement = (
        typeof this.baseComponent === 'function'
          ? this.baseComponent({ ...props })
          : createElement(this.baseComponent, { ...props })
      ) as ReactElement;

      const renderedChildren = cloneElement(reactElement, {
        ...reactElement.props,
        className: composeClassNames(
          reactElement.props.className,
          composedComponentClassNames,
        ),
      });

      const Wrapper =
        composedHostClassNames || Object.keys(handlers.host ?? {}).length
          ? 'div'
          : Fragment;
      const wrapperProps =
        Wrapper === 'div'
          ? { className: composedHostClassNames, ...handlers.host }
          : {};

      return (
        <Wrapper {...wrapperProps}>
          {this.htmlContentFn?.(
            renderedChildren,
            componentState,
            handlers.component,
          ) ?? renderedChildren}
        </Wrapper>
      );
    };

    Object.defineProperty(Component, 'name', {
      value: this.baseComponent.name,
      writable: false,
      configurable: true,
      enumerable: false,
    });

    return options?.reactMemo ? memo(Component) : Component;
  }

  private readonly baseComponent: Component | (() => null) = () => null;

  private stylesFn: CB_StylesFn = () => ({});

  private classNamesFn: CB_ClassNamesFn = () => ({ host: [], component: [] });

  private htmlContentFn: CB_HTMLContentFn = () => null;

  private handlersFn: CB_HandlersFn = () => ({ host: {}, component: {} });

  private stateFn: CB_StateFn = () => ({
    state: {},
    setState: () => ({}),
  });

  private effectsFn: CB_EffectsFn = () => [];

  private useClassNames = (componentState: CB_State) => {
    return this.classNamesFn?.(componentState) ?? {};
  };

  private useStyles = (componentState: CB_State, componentName?: string) => {
    const { host: hostStyles, component: componentStyles } =
      this.stylesFn?.(componentState) ?? {};
    const useCreatedStyles = createUseStyles(
      {
        ...(hostStyles ? { host: hostStyles } : {}),
        ...(componentStyles ? { component: componentStyles } : {}),
      } as Styles,
      {
        name: componentName,
        generateId: createGenerateId(),
      },
    );

    return useCreatedStyles() as { host?: string; component?: string };
  };

  private useHandlers = (
    componentState: CB_State,
    setComponentState: Dispatch<SetStateAction<CB_State>>,
  ) => {
    return this.handlersFn?.(componentState, setComponentState) ?? {};
  };

  private useEffectsRunner = (
    effectsFn: CB_EffectsFn,
    componentState: CB_State,
    setComponentState: Dispatch<SetStateAction<CB_State>>,
  ) => {
    effectsFn?.(componentState, setComponentState).forEach(
      ({ effect, dependencies }) => {
        useEffect(effect, [...dependencies, effect]);
      },
    );
  };

  private applyHTMLReplacements(
    children: ReactNode | ReactNode[],
    state: CB_State,
    handlers: CB_ComponentHandlers,
  ): ReactNode | ReactNode[] {
    return Children.map(children, (child: ReactNode) => {
      if (!isValidElement(child)) {
        return child;
      }

      const customizeId = child.props[DATA_CUSTOMIZE_ID];

      if (customizeId && this.htmlReplacements[customizeId as BlockIds]) {
        const replacedContent = this.htmlReplacements[customizeId as BlockIds]!(
          cloneElement(child, {
            [DATA_CUSTOMIZE_ID]: undefined,
          } as HTMLAttributes<HTMLElement>),
          state,
          handlers,
        );

        if (!isValidElement(replacedContent)) {
          return child;
        }

        return cloneElement(replacedContent, {
          [DATA_CUSTOMIZE_ID]: customizeId,
          ...(replacedContent.props.children && {
            children: this.applyHTMLReplacements(
              replacedContent.props.children,
              state,
              handlers,
            ),
          }),
        } as HTMLAttributes<HTMLElement>);
      }

      return cloneElement(child, {
        ...(child.props.children && {
          children: this.applyHTMLReplacements(
            child.props.children,
            state,
            handlers,
          ),
        }),
      } as HTMLAttributes<HTMLElement>);
    });
  }
}

export default ComponentBuilder;

import React, {
  ComponentProps,
  MouseEventHandler,
  ReactElement,
  TouchEvent,
} from 'react';

const longPressDuration = 610;

class ContextMenuHandler {
  callback: MouseEventHandler | undefined;
  longPressCountdown: ReturnType<typeof setTimeout> | null = null;
  contextMenuPossible = false;

  constructor(callback: MouseEventHandler | undefined) {
    this.callback = callback;
  }

  onTouchStart = (e: TouchEvent) => {
    this.contextMenuPossible = true;
    const touch = e.touches[0];

    this.longPressCountdown = setTimeout(() => {
      if (this.callback) {
        this.contextMenuPossible = false;
        this.callback(
          touch as unknown as React.MouseEvent<HTMLElement, MouseEvent>,
        );
      }
    }, longPressDuration);
  };

  onTouchMove = () => {
    if (this.longPressCountdown) {
      clearTimeout(this.longPressCountdown);
    }
  };

  onTouchCancel = () => {
    this.contextMenuPossible = false;
    if (this.longPressCountdown) {
      clearTimeout(this.longPressCountdown);
    }
  };

  onTouchEnd = () => {
    this.contextMenuPossible = false;
    if (this.longPressCountdown) {
      clearTimeout(this.longPressCountdown);
    }
  };

  onContextMenu = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (this.contextMenuPossible && this.callback) {
      this.callback(e);
    }
    e.preventDefault();
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const withContextMenu = <T extends React.ComponentType<any>>(
  WrappedComponent: T,
) => {
  const ComponentWithContextMenu = (props: ComponentProps<T>): ReactElement => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { onContextMenu, ...rest } = props as any;

    const handler = new ContextMenuHandler(onContextMenu);

    return (
      <WrappedComponent
        onTouchStart={handler.onTouchStart}
        onTouchMove={handler.onTouchMove}
        onTouchCancel={handler.onTouchCancel}
        onTouchEnd={handler.onTouchEnd}
        onContextMenu={handler.onContextMenu}
        {...rest}
      />
    );
  };

  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';
  ComponentWithContextMenu.displayName = `withContextMenu(${displayName})`;

  return ComponentWithContextMenu;
};

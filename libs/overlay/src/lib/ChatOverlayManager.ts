import { ChatOverlay } from './ChatOverlay';

import { ChatOverlayOptions, setStyles } from '@epam/ai-dial-shared';

export type OverlayPosition =
  | 'left-bottom'
  | 'left-top'
  | 'right-bottom'
  | 'right-top';

export interface Position {
  top: string;
  bottom: string;
  left: string;
  right: string;
  transform: string;
}

/**
 * Returns the styles for overlay placement
 * @returns {Record<OverlayPosition, Position>} styles for overlay placement
 */
const getPosition = (): Record<OverlayPosition, Position> => {
  return {
    'left-bottom': {
      top: 'initial',
      bottom: '20px',
      left: '20px',
      right: 'initial',
      transform: `translate(-${window.innerWidth * 2}px, ${
        window.innerHeight * 2
      }px)`,
    },
    'left-top': {
      top: '20px',
      bottom: 'initial',
      left: '20px',
      right: 'initial',
      transform: `translate(-${window.innerWidth * 2}px, -${
        window.innerHeight * 2
      }px)`,
    },
    'right-top': {
      top: '20px',
      bottom: 'initial',
      left: 'initial',
      right: '20px',
      transform: `translate(${window.innerWidth * 2}px, -${
        window.innerHeight * 2
      }px)`,
    },
    'right-bottom': {
      top: 'initial',
      bottom: '20px',
      left: 'initial',
      right: '20px',
      transform: `translate(${window.innerWidth * 2}px, ${
        window.innerHeight * 2
      }px)`,
    },
  };
};

/**
 * Returns default icon for button which shows overlay
 * @param height height of svg
 * @param width width of svg
 * @returns {string}
 */
const getDefaultSVG = (height: number, width: number): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-message-circle-2-filled" width="${width}" height="${height}" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M5.821 4.91c3.898 -2.765 9.469 -2.539 13.073 .536c3.667 3.127 4.168 8.238 1.152 11.897c-2.842 3.447 -7.965 4.583 -12.231 2.805l-.232 -.101l-4.375 .931l-.075 .013l-.11 .009l-.113 -.004l-.044 -.005l-.11 -.02l-.105 -.034l-.1 -.044l-.076 -.042l-.108 -.077l-.081 -.074l-.073 -.083l-.053 -.075l-.065 -.115l-.042 -.106l-.031 -.113l-.013 -.075l-.009 -.11l.004 -.113l.005 -.044l.02 -.11l.022 -.072l1.15 -3.451l-.022 -.036c-2.21 -3.747 -1.209 -8.392 2.411 -11.118l.23 -.168z" stroke-width="0" fill="currentColor" />
  </svg>`;
};

const overlayToggleIconOptions = {
  iconBgColor: '#444654',
  iconColor: 'white',
  iconHeight: 60,
  iconWidth: 60,
  iconSvg: getDefaultSVG(60, 60),
};

export type ChatOverlayManagerOptions = ChatOverlayOptions & {
  id: string;

  position?: OverlayPosition;

  allowFullscreen?: boolean;

  width?: string;
  height?: string;
  zIndex?: string;

  iconSvg?: string;
  iconHeight?: number;
  iconWidth?: number;
  iconBgColor?: string;
  iconColor?: string;
};

const defaultOverlayPlacementOptions: Pick<
  ChatOverlayManagerOptions,
  'width' | 'height' | 'zIndex'
> = {
  width: '540px',
  height: '540px',
  zIndex: '5',
};

interface Overlay {
  container: HTMLElement;
  toggleButton: HTMLElement;

  overlay: ChatOverlay;

  options: ChatOverlayManagerOptions;
  isHidden: boolean;

  position: Position;
}
/**
 * Class provides overlay factory, different styles and animation for overlay (for example: opening animation, auto placement, fullscreen button, etc.)
 */
export class ChatOverlayManager {
  protected overlays: Overlay[];

  private listenerAbortController = new AbortController();

  /**
   * Creates a ChatOverlayManager
   */
  constructor() {
    this.overlays = [];

    window.addEventListener(
      'orientationchange',
      () => {
        for (const overlay of this.overlays) {
          this.updateOverlay(overlay.options.id);
        }
      },
      { signal: this.listenerAbortController.signal },
    );

    window.addEventListener(
      'resize',
      () => {
        for (const overlay of this.overlays) {
          this.updateOverlay(overlay.options.id);
        }
      },
      { signal: this.listenerAbortController.signal },
    );
  }

  /**
   * Creates HTML Container and put ChatOverlay to it, saves to this.overlays
   * Received same options as ChatOverlay, but contains 'id' and settings how to place this overlay
   * @param options {ChatOverlayManagerOptions} ChatOverlayOptions with `id` and settings how to place this overlay
   */
  public createOverlay(options: ChatOverlayManagerOptions) {
    const container = document.createElement('div');

    const overlayContainer = document.createElement('div');
    const controlsContainer = document.createElement('div');

    const position = getPosition()[options?.position || 'right-bottom'];

    const toggleButton = this.createOverlayToggle(position, options);
    const closeButton = this.createCloseButton();
    const fullscreenButton = this.createFullscreenButton();

    setStyles(controlsContainer, {
      display: 'flex',
      alignItems: 'end',
      justifyContent: 'end',
      height: '30px',
      paddingRight: '10px',
      backgroundColor: '#444654',
    });

    setStyles(overlayContainer, {
      height: 'calc(100% - 30px)',
    });

    toggleButton.onclick = () => this.showOverlay(options.id);
    document.body.appendChild(toggleButton);

    closeButton.onclick = () => this.hideOverlay(options.id);
    fullscreenButton.onclick = () => this.openFullscreen(options.id);

    controlsContainer.appendChild(closeButton);

    const overlay = new ChatOverlay(overlayContainer, options);

    if (options.allowFullscreen) {
      overlay.allowFullscreen();
      controlsContainer.appendChild(fullscreenButton);
    }

    this.overlays.push({
      container,
      overlay,
      options,
      isHidden: false,
      position,
      toggleButton,
    });

    container.appendChild(controlsContainer);
    container.appendChild(overlayContainer);

    this.updateOverlay(options.id);
    this.hideOverlay(options.id);

    document.body.appendChild(container);
  }

  /**
   * Creates toggle button to show overlay
   * @param position overlay placement, needed to show button in the same place where would be the overlay
   * @param options overlay options, needed to show cu
   * @returns {HTMLButtonElement} Reference to created toggle button
   */
  public createOverlayToggle(
    position: Position,
    options: ChatOverlayManagerOptions,
  ): HTMLButtonElement {
    const button = document.createElement('button');

    setStyles(button, {
      backgroundColor:
        options?.iconBgColor || overlayToggleIconOptions.iconBgColor,
      borderRadius: '100%',
      border: 'none',
      height: `${options?.iconHeight || overlayToggleIconOptions.iconHeight}px`,
      width: `${options?.iconWidth || overlayToggleIconOptions.iconWidth}px`,
      color: options.iconColor || overlayToggleIconOptions.iconColor,
      cursor: 'pointer',
      position: 'fixed',
      top: position.top,
      bottom: position.bottom,
      left: position.left,
      right: position.right,
    });

    button.innerHTML = options?.iconSvg || overlayToggleIconOptions.iconSvg;
    button.name = 'open';
    return button;
  }

  /**
   * Creates button to open overlay in fullscreen mode
   * @returns {HTMLButtonElement} Reference to created fullscreen button
   */
  public createFullscreenButton(): HTMLButtonElement {
    const button = document.createElement('button');

    setStyles(button, {
      appearance: 'none',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      boxSizing: 'border-box',
      height: '100%',
      width: '20px',
      paddingTop: '15px',
      paddingBottom: '8px',
      paddingRight: '5px',
      paddingLeft: '5px',
      display: 'flex',
      alignItems: 'end',
    });

    const buttonInnerElement = document.createElement('span');

    setStyles(buttonInnerElement, {
      boxSizing: 'border-box',
      border: '1px solid white',
      borderRadius: '2px',
      display: 'block',
      height: '10px',
      width: '10px',
    });

    button.appendChild(buttonInnerElement);

    return button;
  }

  /**
   * Creates button which hides overlay
   * @returns {HTMLButtonElement} Reference to created close button
   */
  public createCloseButton(): HTMLButtonElement {
    const closeButton = document.createElement('button');

    setStyles(closeButton, {
      boxSizing: 'border-box',
      appearance: 'none',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      height: '100%',
      width: '20px',
      display: 'flex',
      paddingTop: '15px',
      paddingBottom: '8px',
      paddingRight: '5px',
      paddingLeft: '5px',
      alignItems: 'end',
    });

    const closeButtonInnerElement = document.createElement('span');

    setStyles(closeButtonInnerElement, {
      boxSizing: 'border-box',
      border: '1px solid white',
      borderRadius: '2px',
      width: '100%',
      display: 'block',
    });

    closeButton.appendChild(closeButtonInnerElement);

    return closeButton;
  }

  /**
   * Destroys overlay with specified id and removes from this.overlays
   * @param id {string} id of overlay that should be deleted
   */
  public removeOverlay(id: string) {
    const { overlay, container, toggleButton } = this.getOverlay(id);

    overlay.destroy();

    this.overlays = this.overlays.filter(({ options }) => options.id !== id);

    document.body.removeChild(container);
    document.body.removeChild(toggleButton);
  }

  public openFullscreen(id: string) {
    const { overlay } = this.getOverlay(id);

    overlay.openFullscreen();
  }

  /**
   * Shows overlay with specified id
   * @param id {string} id of overlay that should be shown
   */
  public showOverlay(id: string) {
    const overlay = this.getOverlay(id);

    overlay.isHidden = false;
    overlay.container.style.transform = 'scale(1) translate(0, 0)';
  }
  /**
   * Hides overlay with specified id
   * @param id {string} id of overlay that should be hidden
   */
  public hideOverlay(id: string) {
    const overlay = this.getOverlay(id);

    overlay.isHidden = true;
    overlay.container.style.transform = `scale(1) ${overlay.position.transform}`;
  }

  /**
   * Checks the current viewport and updates position, styles if needed
   * @param id {string} id of overlay that should be updated
   */
  public updateOverlay(id: string) {
    const { container, options, isHidden } = this.getOverlay(id);

    const mobileHeight = `${window.innerHeight}px`;

    const isMobileView = this.isMobileView();

    const position = getPosition()[options.position ?? 'right-bottom'];

    setStyles(container, {
      transition: 'transform 0.5s ease',
      position: 'fixed',

      top: isMobileView ? '0' : position.top,
      bottom: isMobileView ? '0' : position.bottom,
      left: isMobileView ? '0' : position.left,
      right: isMobileView ? '0' : position.right,

      transform: !isHidden
        ? container.style.transform
        : `scale(0.5) ${position.transform}`,

      zIndex: options.zIndex || defaultOverlayPlacementOptions.zIndex,

      width: isMobileView
        ? '100vw'
        : options.width || defaultOverlayPlacementOptions.width,

      height: isMobileView
        ? mobileHeight
        : options.height || defaultOverlayPlacementOptions.height,
    });
  }

  public setSystemPrompt(id: string, systemPrompt: string) {
    const { overlay } = this.getOverlay(id);

    return overlay.setSystemPrompt(systemPrompt);
  }

  public async getMessages(id: string) {
    const { overlay } = this.getOverlay(id);

    return overlay.getMessages();
  }

  public async sendMessage(id: string, content: string) {
    const { overlay } = this.getOverlay(id);

    return overlay.sendMessage(content);
  }

  public async getConversations(id: string) {
    const { overlay } = this.getOverlay(id);

    return overlay.getConversations();
  }

  public async createConversation(id: string, parentPath?: string | null) {
    const { overlay } = this.getOverlay(id);

    return overlay.createConversation(parentPath);
  }

  public async selectConversation(id: string, conversationId: string) {
    const { overlay } = this.getOverlay(id);

    return overlay.createConversation(conversationId);
  }

  public async setOverlayOptions(id: string, options: ChatOverlayOptions) {
    const { overlay } = this.getOverlay(id);

    return overlay.setOverlayOptions(options);
  }

  public subscribe(
    id: string,
    eventType: string,
    callback: (payload?: unknown) => void,
  ) {
    const { overlay } = this.getOverlay(id);

    return overlay.subscribe(eventType, callback);
  }

  /**
   * Get reference to overlay from this.overlay with specified id
   * Throws exception if there is no such overlay with specified id
   * @param id {string} id of overlay that should be returned
   * @returns {Overlay} reference to overlay with specified id
   */
  protected getOverlay(id: string): Overlay {
    const overlay = this.overlays.find(({ options }) => options.id === id);

    if (!overlay) throw new Error(`There is no overlay with ${id}`);

    return overlay;
  }

  /**
   * Checks that window has mobile view
   * @returns {boolean} Returns true if window has mobile view
   */
  protected isMobileView(): boolean {
    return (
      (window.matchMedia('(orientation:landscape)').matches &&
        window.matchMedia('(max-height: 550px)').matches) ||
      (window.matchMedia('(orientation:portrait)').matches &&
        window.matchMedia('(max-width: 550px)').matches)
    );
  }

  /**
   * Destroys all overlays and stop event listeners
   */
  public destroy(): void {
    this.listenerAbortController.abort();

    for (const { overlay, container } of this.overlays) {
      overlay.destroy();
      document.body.removeChild(container);
    }
  }
}

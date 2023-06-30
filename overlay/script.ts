export type PositionConfigValue =
  | 'left-bottom'
  | 'left-top'
  | 'right-bottom'
  | 'right-top';

interface PositionModel {
  top: string;
  bottom: string;
  left: string;
  right: string;
  transform: string;
}

export interface ChatAIOverlayInitialConfigModel {
  domain: string;
  position?: PositionConfigValue;
  overlayWidth?: number;
  overlayHeight?: number;
  overlayZIndex?: string;
  // True by default
  showButtonIcon?: boolean;
  allowFulscreenDesktop?: boolean;
  iconWidth?: number;
  iconHeight?: number;
  iconBgColor?: string;
  iconColor?: string;
  iconSvg?: string;
  // Function which will be called when internal iframe will be loaded
  onLoad?: (chatAIOverlay: ChatAIOverlay) => void;
}

type ChatAIOverlayConfigModel = Required<
  Omit<ChatAIOverlayInitialConfigModel, 'position'> & {
    position: PositionModel;
  }
>;

function getPosition(): Record<PositionConfigValue | string, PositionModel> {
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
}

const getDefaultSVG = (height: number, width: number) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-message-circle-2-filled" width="${width}" height="${height}" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M5.821 4.91c3.898 -2.765 9.469 -2.539 13.073 .536c3.667 3.127 4.168 8.238 1.152 11.897c-2.842 3.447 -7.965 4.583 -12.231 2.805l-.232 -.101l-4.375 .931l-.075 .013l-.11 .009l-.113 -.004l-.044 -.005l-.11 -.02l-.105 -.034l-.1 -.044l-.076 -.042l-.108 -.077l-.081 -.074l-.073 -.083l-.053 -.075l-.065 -.115l-.042 -.106l-.031 -.113l-.013 -.075l-.009 -.11l.004 -.113l.005 -.044l.02 -.11l.022 -.072l1.15 -3.451l-.022 -.036c-2.21 -3.747 -1.209 -8.392 2.411 -11.118l.23 -.168z" stroke-width="0" fill="currentColor" />
  </svg>`;
};

const defaultConfig: ChatAIOverlayConfigModel = {
  domain: '',
  position: getPosition()['right-bottom'],
  showButtonIcon: true,
  allowFulscreenDesktop: false,
  overlayHeight: 380,
  overlayWidth: 540,
  iconBgColor: '#444654',
  iconColor: 'white',
  iconHeight: 60,
  iconWidth: 60,
  iconSvg: getDefaultSVG(45, 45),
  overlayZIndex: '5',
  onLoad: (chatAIOverlay: ChatAIOverlay) => {},
};

export default class ChatAIOverlay {
  public overlayShowed = false;
  private overlay: HTMLElement | undefined;
  private button: HTMLElement | undefined;
  private initialPosition: PositionConfigValue | undefined;
  private position: PositionModel = getPosition()['right-bottom'];
  private config: ChatAIOverlayConfigModel = defaultConfig;
  private isMobileView = this.getIsMobileView();
  private iframe: HTMLIFrameElement | undefined;
  private listenerAbortController = new AbortController();

  constructor(config: string | ChatAIOverlayInitialConfigModel) {
    if (!config) {
      throw Error('No config provided for ChatAIOverlay');
    }

    window.addEventListener(
      'orientationchange',
      () => {
        this.isMobileView = this.getIsMobileView();
        if (this.overlay) {
          this.updateOverlay(this.overlay);
        }
      },
      { signal: this.listenerAbortController.signal },
    );
    window.addEventListener(
      'resize',
      () => {
        this.isMobileView = this.getIsMobileView();
        if (this.overlay) {
          this.updateOverlay(this.overlay);
        }
      },
      { signal: this.listenerAbortController.signal },
    );

    if (typeof config === 'string') {
      this.config = {
        ...defaultConfig,
        domain: config,
      };
    } else {
      if (!config.domain) {
        throw Error('No domain provided for ChatAIOverlay');
      }
      this.initialPosition = config.position;
      this.config = {
        ...defaultConfig,
        ...config,
        position:
          (config.position && getPosition()[config.position]) ||
          defaultConfig.position,
        iconSvg:
          config.iconSvg ??
          getDefaultSVG(
            (config.iconHeight ?? defaultConfig.iconHeight) - 15,
            (config.iconWidth ?? defaultConfig.iconWidth) - 15,
          ),
      };
    }
  }

  public load(): void {
    this.overlay = this.createOverlayElements();

    document.body.appendChild(this.overlay);
  }

  public unload(): void {
    this.listenerAbortController.abort();
    this.overlay?.remove();
    this.button?.remove();
  }

  public closeChat(): void {
    if (!this.overlay) {
      return;
    }

    this.overlay.style.transform = `scale(0.5) ${this.position.transform}`;
    setTimeout(() => {
      this.overlayShowed = false;
    }, 500);
  }

  public openChat(): void {
    if (!this.overlay) {
      return;
    }

    this.overlay.style.transform = 'scale(1) translate(0, 0)';
    this.overlayShowed = true;
  }

  public toggleChat(): void {
    this.overlayShowed ? this.closeChat() : this.openChat();
  }

  private getIsMobileView() {
    return (
      (window.matchMedia('(orientation:landscape)').matches &&
        window.matchMedia('(max-height: 550px)').matches) ||
      (window.matchMedia('(orientation:portrait)').matches &&
        window.matchMedia('(max-width: 550px)').matches)
    );
  }

  private openFullscreen(): void {
    this.iframe?.requestFullscreen();
  }

  private createOverlayElements() {
    const overlay = this.createOverlay();

    const iframe = this.createIframe();
    this.iframe = iframe;

    const overlayTopContainer = this.createOverlayControlElements();
    overlay.appendChild(overlayTopContainer);
    overlay.appendChild(iframe);

    return overlay;
  }

  private createOverlayControlElements() {
    const overlayTopContainer = document.createElement('div');
    this.setStyles(overlayTopContainer, {
      backgroundColor: '#444654',
      height: '30px',
      width: '100%',
      display: 'flex',
      justifyContent: 'end',
    });

    const overlayButtonsContainer = document.createElement('div');
    this.setStyles(overlayButtonsContainer, {
      height: '100%',
      display: 'flex',
      justifyContent: 'end',
      alignItems: 'end',
      marginRight: '10px',
      boxSizing: 'border-box',
    });

    const closeButton = document.createElement('button');
    this.setStyles(closeButton, {
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
    closeButton.addEventListener('click', () => this.toggleChat());

    const closeButtonInnerElement = document.createElement('span');
    this.setStyles(closeButtonInnerElement, {
      boxSizing: 'border-box',
      border: '1px solid white',
      borderRadius: '2px',
      width: '100%',
      display: 'block',
    });

    closeButton.appendChild(closeButtonInnerElement);

    overlayButtonsContainer.appendChild(closeButton);

    if (!this.isMobileView && this.config.allowFulscreenDesktop) {
      const fulscreenButton = this.createFullscreenButton();

      overlayButtonsContainer.appendChild(fulscreenButton);
    }
    overlayTopContainer.appendChild(overlayButtonsContainer);
    return overlayTopContainer;
  }

  private createIframe() {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', this.config.domain);
    this.setStyles(iframe, {
      appearance: 'none',
      border: 'none',
      width: '100%',
      height: 'calc(100% - 20px)',
    });
    iframe.allow = 'clipboard-write';
    iframe.allowFullscreen = this.config.allowFulscreenDesktop;
    iframe.sandbox.add('allow-same-origin');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-modals');
    iframe.sandbox.add('allow-forms');
    iframe.onload = () => {
      if (this.config.showButtonIcon) {
        this.button = this.createOverlayButton(this.position);
        this.button.addEventListener('click', () => this.toggleChat());
        document.body.appendChild(this.button);
      }

      if (this.config.onLoad) {
        this.config.onLoad(this);
      }
    };
    return iframe;
  }

  private createOverlay() {
    let overlay = document.createElement('div');
    return this.updateOverlay(overlay);
  }

  private updateOverlay(overlay: HTMLElement) {
    if (!this.initialPosition) {
      return overlay;
    }

    const mobileHeight = window.innerHeight;
    this.position = getPosition()[this.initialPosition];
    this.setStyles(overlay, {
      transition: 'transform 0.5s ease',
      position: 'fixed',
      top: this.isMobileView ? '0' : this.config.position.top,
      bottom: this.isMobileView ? '0' : this.config.position.bottom,
      left: this.isMobileView ? '0' : this.config.position.left,
      right: this.isMobileView ? '0' : this.config.position.right,
      transform: this.overlayShowed
        ? this.overlay?.style.transform
        : `scale(0.5) ${this.config.position.transform}`,
      zIndex: this.config.overlayZIndex,
      width: this.isMobileView ? '100vw' : `${this.config.overlayWidth}px`,
      height: this.isMobileView
        ? `${mobileHeight}px`
        : `${this.config.overlayHeight}px`,
    });

    return overlay;
  }

  private createFullscreenButton() {
    const fulscreenButton = document.createElement('button');
    this.setStyles(fulscreenButton, {
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
    fulscreenButton.addEventListener('click', () => {
      this.openFullscreen();
    });

    const fulscreenButtonInnerElement = document.createElement('span');
    this.setStyles(fulscreenButtonInnerElement, {
      boxSizing: 'border-box',
      border: '1px solid white',
      borderRadius: '2px',
      display: 'block',
      height: '10px',
      width: '10px',
    });

    fulscreenButton.appendChild(fulscreenButtonInnerElement);

    return fulscreenButton;
  }

  private createOverlayButton(position: PositionModel) {
    let button = document.createElement('button');
    button.id = 'chatButton';

    this.setStyles(button, {
      backgroundColor: this.config.iconBgColor,
      borderRadius: '100%',
      border: 'none',
      height: `${this.config.iconHeight}px`,
      width: `${this.config.iconWidth}px`,
      color: this.config.iconColor,
      cursor: 'pointer',
      position: 'fixed',
      top: position.top,
      bottom: position.bottom,
      left: position.left,
      right: position.right,
    });
    button.innerHTML = this.config.iconSvg;

    return button;
  }

  private setStyles(
    htmlElement: HTMLElement,
    styles: { [property in keyof CSSStyleDeclaration]?: string },
  ) {
    Object.entries(styles).map(([key, value]) => {
      if (value && key) {
        htmlElement.style[key as any] = value;
      }
    });
  }
}

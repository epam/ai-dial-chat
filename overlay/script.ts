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
  // True by default
  showButtonIcon?: boolean;
  allowFulscreen?: boolean;
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

const Positions: Record<PositionConfigValue | string, PositionModel> = {
  'left-bottom': {
    top: 'initial',
    bottom: '20px',
    left: '20px',
    right: 'initial',
    transform: 'translate(-1080px, 800px)',
  },
  'left-top': {
    top: '20px',
    bottom: 'initial',
    left: '20px',
    right: 'initial',
    transform: 'translate(-1080px, -800px)',
  },
  'right-top': {
    top: '20px',
    bottom: 'initial',
    left: 'initial',
    right: '20px',
    transform: 'translate(1080px, -800px)',
  },
  'right-bottom': {
    top: 'initial',
    bottom: '20px',
    left: 'initial',
    right: '20px',
    transform: 'translate(1080px, 800px)',
  },
};

const getDefaultSVG = (height: number, width: number) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-message-circle-2-filled" width="${width}" height="${height}" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M5.821 4.91c3.898 -2.765 9.469 -2.539 13.073 .536c3.667 3.127 4.168 8.238 1.152 11.897c-2.842 3.447 -7.965 4.583 -12.231 2.805l-.232 -.101l-4.375 .931l-.075 .013l-.11 .009l-.113 -.004l-.044 -.005l-.11 -.02l-.105 -.034l-.1 -.044l-.076 -.042l-.108 -.077l-.081 -.074l-.073 -.083l-.053 -.075l-.065 -.115l-.042 -.106l-.031 -.113l-.013 -.075l-.009 -.11l.004 -.113l.005 -.044l.02 -.11l.022 -.072l1.15 -3.451l-.022 -.036c-2.21 -3.747 -1.209 -8.392 2.411 -11.118l.23 -.168z" stroke-width="0" fill="currentColor" />
  </svg>`;
};

const defaultConfig: ChatAIOverlayConfigModel = {
  domain: '',
  position: Positions['right-bottom'],
  showButtonIcon: true,
  allowFulscreen: false,
  overlayHeight: 380,
  overlayWidth: 540,
  iconBgColor: '#444654',
  iconColor: 'white',
  iconHeight: 60,
  iconWidth: 60,
  iconSvg: getDefaultSVG(45, 45),
  onLoad: (chatAIOverlay: ChatAIOverlay) => {},
};

export default class ChatAIOverlay {
  public overlayShowed = false;
  private overlay: HTMLElement | undefined;
  private position: PositionModel = Positions['right-bottom'];
  private config: ChatAIOverlayConfigModel = defaultConfig;

  constructor(config: string | ChatAIOverlayInitialConfigModel) {
    if (!config) {
      throw Error('No config provided for ChatAIOverlay');
    }

    if (typeof config === 'string') {
      this.config = {
        ...defaultConfig,
        domain: config,
      };
    } else {
      if (!config.domain) {
        throw Error('No domain provided for ChatAIOverlay');
      }
      this.config = {
        ...defaultConfig,
        ...config,
        position:
          (config.position && Positions[config.position]) ||
          defaultConfig.position,
      };
    }
  }

  public load(): void {
    this.overlay = this.createOverlayElements();

    document.body.appendChild(this.overlay);
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

  private createOverlayElements() {
    const overlay = this.createOverlay();

    const iframe = this.createIframe();

    const overlayTopContainer = this.createOverlayControlElements(iframe);
    overlay.appendChild(overlayTopContainer);
    overlay.appendChild(iframe);

    return overlay;
  }

  private createOverlayControlElements(iframe: HTMLIFrameElement) {
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

    if (this.config.allowFulscreen) {
      const fulscreenButton = this.createFullscreenButton(iframe);

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
    iframe.allowFullscreen = this.config.allowFulscreen;
    iframe.sandbox.add('allow-same-origin');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-modals');
    iframe.onload = () => {
      if (this.config.showButtonIcon) {
        const button = this.createOverlayButton(this.position);
        button.addEventListener('click', () => this.toggleChat());
        document.body.appendChild(button);
      }

      if (this.config.onLoad) {
        this.config.onLoad(this);
      }
    };
    return iframe;
  }

  private createOverlay() {
    const overlay = document.createElement('div');
    this.setStyles(overlay, {
      transition: 'transform 0.5s ease',
      position: 'fixed',
      top: this.config.position.top,
      bottom: this.config.position.bottom,
      left: this.config.position.left,
      right: this.config.position.right,
      transform: `scale(0.5) ${this.config.position.transform}`,
      zIndex: '2',
      width: `${this.config.overlayWidth}px`,
      height: `${this.config.overlayHeight}px`,
    });
    return overlay;
  }

  private createFullscreenButton(iframe: HTMLIFrameElement) {
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
      iframe.requestFullscreen();
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
    button.innerHTML = getDefaultSVG(
      this.config.iconWidth - 15,
      this.config.iconHeight - 15,
    );

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

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
const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-message-circle-2-filled" width="44" height="44" viewBox="0 0 24 24" stroke-width="1.5" stroke="#2c3e50" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
<path d="M5.821 4.91c3.898 -2.765 9.469 -2.539 13.073 .536c3.667 3.127 4.168 8.238 1.152 11.897c-2.842 3.447 -7.965 4.583 -12.231 2.805l-.232 -.101l-4.375 .931l-.075 .013l-.11 .009l-.113 -.004l-.044 -.005l-.11 -.02l-.105 -.034l-.1 -.044l-.076 -.042l-.108 -.077l-.081 -.074l-.073 -.083l-.053 -.075l-.065 -.115l-.042 -.106l-.031 -.113l-.013 -.075l-.009 -.11l.004 -.113l.005 -.044l.02 -.11l.022 -.072l1.15 -3.451l-.022 -.036c-2.21 -3.747 -1.209 -8.392 2.411 -11.118l.23 -.168z" stroke-width="0" fill="currentColor" />
</svg>`;

const defaultConfig: ChatAIOverlayConfigModel = {
  domain: '',
  position: Positions['right-bottom'],
  showButtonIcon: true,
  allowFulscreen: false,
  overlayHeight: 380,
  overlayWidth: 540,
  iconBgColor: '#444654',
  iconColor: 'white',
  iconSvg: defaultSvg,
  iconHeight: 60,
  iconWidth: 60,
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

  public load() {
    const { overlay } = this.createIframe();
    this.overlay = overlay;

    document.body.appendChild(overlay);
  }

  public closeChat() {
    if (!this.overlay) {
      return;
    }

    this.overlay.style.transform = `scale(0.5) ${this.position.transform}`;
    setTimeout(() => {
      this.overlayShowed = false;
    }, 500);
  }

  public openChat() {
    if (!this.overlay) {
      return;
    }
    this.overlay.style.transform = 'scale(1) translate(0, 0)';
    this.overlayShowed = true;
  }

  public toggleChat() {
    this.overlayShowed ? this.closeChat() : this.openChat();
  }

  private createIframe() {
    const overlay = document.createElement('div');
    overlay.style.transition = 'transform 0.5s ease';
    overlay.style.position = 'fixed';
    overlay.style.top = this.config.position.top;
    overlay.style.bottom = this.config.position.bottom;
    overlay.style.left = this.config.position.left;
    overlay.style.right = this.config.position.right;
    overlay.style.transform = `scale(0.5) ${this.config.position.transform}`;
    overlay.style.zIndex = '2';
    overlay.style.width = `${this.config.overlayWidth}px`;
    overlay.style.height = `${this.config.overlayHeight}px`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', this.config.domain);
    iframe.style.appearance = 'none';
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = 'calc(100% - 20px)';
    iframe.allow = 'clipboard-write';
    iframe.allowFullscreen = this.config.allowFulscreen;
    iframe.sandbox.add('allow-same-origin');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-modals');
    iframe.onload = () => {
      if (this.config.showButtonIcon) {
        const button = this.createButton(this.position);
        button.addEventListener('click', () => this.toggleChat());
        document.body.appendChild(button);
      }

      if (this.config.onLoad) {
        this.config.onLoad(this);
      }
    };

    const closeMenu = document.createElement('div');
    closeMenu.style.backgroundColor = '#444654';
    closeMenu.style.height = '30px';
    closeMenu.style.width = '100%';
    closeMenu.style.display = 'flex';
    closeMenu.style.justifyContent = 'end';

    const overlayButtonsContainer = document.createElement('div');
    overlayButtonsContainer.style.height = '100%';
    overlayButtonsContainer.style.display = 'flex';
    overlayButtonsContainer.style.justifyContent = 'end';
    overlayButtonsContainer.style.alignItems = 'end';
    overlayButtonsContainer.style.marginRight = '10px';
    overlayButtonsContainer.style.boxSizing = 'border-box';

    const closeButton = document.createElement('button');
    closeButton.style.boxSizing = 'border-box';
    closeButton.style.appearance = 'none';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.height = '100%';
    closeButton.style.width = '20px';
    closeButton.style.display = 'flex';
    closeButton.style.paddingTop = '15px';
    closeButton.style.paddingBottom = '8px';
    closeButton.style.paddingRight = '5px';
    closeButton.style.paddingLeft = '5px';
    closeButton.style.alignItems = 'end';
    closeButton.addEventListener('click', () => this.toggleChat());
    const closeButtonInnerElement = document.createElement('span');
    closeButtonInnerElement.style.boxSizing = 'border-box';
    closeButtonInnerElement.style.border = '1px solid white';
    closeButtonInnerElement.style.borderRadius = '2px';
    closeButtonInnerElement.style.width = '100%';
    closeButtonInnerElement.style.display = 'block';

    closeButton.appendChild(closeButtonInnerElement);

    overlayButtonsContainer.appendChild(closeButton);

    if (this.config.allowFulscreen) {
      const fulscreenButton = document.createElement('button');
      fulscreenButton.style.appearance = 'none';
      fulscreenButton.style.border = 'none';
      fulscreenButton.style.backgroundColor = 'transparent';
      fulscreenButton.style.cursor = 'pointer';
      fulscreenButton.style.boxSizing = 'border-box';
      fulscreenButton.style.height = '100%';
      fulscreenButton.style.width = '20px';
      fulscreenButton.style.paddingTop = '15px';
      fulscreenButton.style.paddingBottom = '8px';
      fulscreenButton.style.paddingRight = '5px';
      fulscreenButton.style.paddingLeft = '5px';
      fulscreenButton.style.display = 'flex';
      fulscreenButton.style.alignItems = 'end';
      fulscreenButton.addEventListener('click', () => {
        iframe.requestFullscreen();
      });

      const fulscreenButtonInnerElement = document.createElement('span');
      fulscreenButtonInnerElement.style.boxSizing = 'border-box';
      fulscreenButtonInnerElement.style.border = '1px solid white';
      fulscreenButtonInnerElement.style.borderRadius = '2px';
      fulscreenButtonInnerElement.style.width = '100%';
      fulscreenButtonInnerElement.style.display = 'block';
      fulscreenButtonInnerElement.style.height = '10px';
      fulscreenButtonInnerElement.style.width = '10px';

      fulscreenButton.appendChild(fulscreenButtonInnerElement);

      overlayButtonsContainer.appendChild(fulscreenButton);
    }
    closeMenu.appendChild(overlayButtonsContainer);
    overlay.appendChild(closeMenu);
    overlay.appendChild(iframe);

    return { overlay };
  }

  createButton(position: PositionModel) {
    let button = document.createElement('button');
    button.id = 'chatButton';
    button.style.backgroundColor = this.config.iconBgColor;
    button.style.borderRadius = '100%';
    button.style.border = 'none';
    button.style.height = `${this.config.iconHeight}px`;
    button.style.width = `${this.config.iconWidth}px`;
    button.style.color = this.config.iconColor;
    button.style.cursor = 'pointer';
    button.style.position = 'fixed';
    button.style.top = position.top;
    button.style.bottom = position.bottom;
    button.style.left = position.left;
    button.style.right = position.right;
    button.innerHTML = this.config.iconSvg;

    return button;
  }
}

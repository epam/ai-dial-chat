import { ChatOverlay, ChatOverlayOptions } from './ChatOverlay';
import { setStyles } from './styleUtils';

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
 * @returns {Record<OverlayPosition | string, Position>} styles for overlay placement
 */
const getPosition = (): Record<OverlayPosition | string, Position> => {
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

type ChatOverlayFullOptions = ChatOverlayOptions & {
  id: string;

  position?: OverlayPosition;

  allowFullscreen?: boolean;

  width?: string;
  height?: string;
  zIndex?: string;
};

const defaultOverlayPlacementOptions: Pick<
  ChatOverlayFullOptions,
  'width' | 'height' | 'zIndex'
> = {
  width: '540px',
  height: '540px',
  zIndex: '5',
};

interface Overlay {
  container: HTMLElement;

  overlay: ChatOverlay;

  options: ChatOverlayFullOptions;
  isHidden: boolean;
}
/**
 * Class provides overlay factory, different styles and animation for overlay (for example: opening animation, auto placement, fullscreen button, etc.)
 */
export class ChatOverlayManager {
  protected overlays: Overlay[];

  /**
   * Creates a ChatOverlayManager
   */
  constructor() {
    this.overlays = [];
  }

  /**
   * Creates HTML Container and put ChatOverlay to it, saves to this.overlays
   * Received same options as ChatOverlay, but contains 'id' and settings how to place this overlay
   * @param options {ChatOverlayFullOptions} ChatOverlayOptions with `id` and settings how to place this overlay
   */
  public createOverlay(options: ChatOverlayFullOptions) {
    const container = document.createElement('div');
    const overlay = new ChatOverlay(container, options);

    if (options.allowFullscreen) {
      overlay.allowFullscreen();
    }

    this.overlays.push({ container, overlay, options, isHidden: false });

    document.body.appendChild(container);
    this.updateOverlay(options.id);
  }

  /**
   * Destroys overlay with specified id and removes from this.overlays
   * @param id {string} id of overlay that should be deleted
   */
  public removeOverlay(id: string) {
    const { overlay, container } = this.getOverlay(id);

    overlay.destroy();

    this.overlays = this.overlays.filter(({ options }) => options.id !== id);

    document.body.removeChild(container);
  }

  /**
   * Shows overlay with specified id
   * @param id {string} id of overlay that should be shown
   */
  public showOverlay(id: string) {
    const overlay = this.getOverlay(id);

    overlay.isHidden = false;
    overlay.container.style.display = 'block';
  }
  /**
   * Hides overlay with specified id
   * @param id {string} id of overlay that should be hidden
   */
  public hideOverlay(id: string) {
    const overlay = this.getOverlay(id);

    overlay.isHidden = true;
    overlay.container.style.display = 'none';
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
}

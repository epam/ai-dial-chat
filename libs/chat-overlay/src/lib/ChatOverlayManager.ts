import type {
  ChatOverlayOptions,
  GetMessagesResponse,
  OverlayEventType,
  SendMessageResponse,
  SetOverlayOptionsResponse,
  SetSystemPromptResponse,
  SetTemperatureResponse,
} from '@epam/ai-dial-chat-shared';
import { ChatOverlay } from './ChatOverlay';
import { setStyles } from './internal/dom-styles';

const MOBILE_BREAKPOINT_PX = 768;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 600;
const DEFAULT_Z_INDEX = 999999;
const EDGE_OFFSET = '24px';

const ICON_TOGGLE =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 4h16v12H7l-3 3V4z"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.41 6.29 6.29-6.29 6.29 1.4 1.41 6.3-6.3 6.3 6.3 1.4-1.41-6.29-6.29 6.29-6.29z"/></svg>';
const ICON_FULLSCREEN =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"/></svg>';

const STYLE_ELEMENT_ID = 'dial-overlay-manager-styles';

const ensureManagerStylesInjected = (): void => {
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
.dial-overlay-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  background: #2764d9;
  color: #ffffff;
}
.dial-overlay-btn:hover,
.dial-overlay-btn:focus-visible {
  background: #1d4fb8;
  outline: 2px solid #1d4fb8;
  outline-offset: 2px;
}
`;
  document.head.appendChild(style);
};

const createButton = (
  ariaLabel: string,
  innerHTML: string,
): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dial-overlay-btn';
  button.setAttribute('aria-label', ariaLabel);
  button.innerHTML = innerHTML;
  return button;
};

const toCssSize = (value: number | string): string =>
  typeof value === 'number' ? `${value}px` : value;

/** Fixed-position placement for a `ChatOverlayManager`-created overlay. */
export enum OverlayPosition {
  /** Anchored to the start (left in LTR) edge, bottom corner. */
  LeftBottom = 'left-bottom',
  /** Anchored to the start (left in LTR) edge, top corner. */
  LeftTop = 'left-top',
  /** Anchored to the end (right in LTR) edge, bottom corner. Default. */
  RightBottom = 'right-bottom',
  /** Anchored to the end (right in LTR) edge, top corner. */
  RightTop = 'right-top',
}

const POSITION_STYLES: Record<OverlayPosition, Record<string, string>> = {
  [OverlayPosition.RightBottom]: {
    insetInlineEnd: EDGE_OFFSET,
    insetBlockEnd: EDGE_OFFSET,
    insetInlineStart: 'auto',
    insetBlockStart: 'auto',
  },
  [OverlayPosition.RightTop]: {
    insetInlineEnd: EDGE_OFFSET,
    insetBlockStart: EDGE_OFFSET,
    insetInlineStart: 'auto',
    insetBlockEnd: 'auto',
  },
  [OverlayPosition.LeftBottom]: {
    insetInlineStart: EDGE_OFFSET,
    insetBlockEnd: EDGE_OFFSET,
    insetInlineEnd: 'auto',
    insetBlockStart: 'auto',
  },
  [OverlayPosition.LeftTop]: {
    insetInlineStart: EDGE_OFFSET,
    insetBlockStart: EDGE_OFFSET,
    insetInlineEnd: 'auto',
    insetBlockEnd: 'auto',
  },
};

/** Options for `ChatOverlayManager.createOverlay`. */
export interface ChatOverlayManagerOptions extends ChatOverlayOptions {
  /** Unique id used to reference this overlay in every manager method. */
  overlayId: string;
  /** Fixed-position corner. Defaults to `OverlayPosition.RightBottom`. */
  position?: OverlayPosition;
  /** Panel width (number treated as px). Defaults to `380`. */
  width?: number | string;
  /** Panel height (number treated as px). Defaults to `600`. */
  height?: number | string;
  /** CSS `z-index` for the panel and toggle button. Defaults to `999999`. */
  zIndex?: number;
  /** Whether to render a fullscreen button in the panel header. */
  allowFullscreen?: boolean;
  /** Accessible name for the toggle button. Defaults to `'Open chat'`. */
  toggleButtonAriaLabel?: string;
  /** Accessible name for the close button. Defaults to `'Collapse'`. */
  closeButtonAriaLabel?: string;
  /** Accessible name for the fullscreen button. Defaults to `'Open full screen'`. */
  fullscreenButtonAriaLabel?: string;
}

interface OverlayEntry {
  overlay: ChatOverlay;
  container: HTMLElement;
  toggleButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  fullscreenButton?: HTMLButtonElement;
  options: ChatOverlayManagerOptions;
}

/**
 * Creates and positions one or more `ChatOverlay` instances behind
 * fixed-position toggle/close/(optional) fullscreen chrome, keyed by
 * `overlayId`.
 */
export class ChatOverlayManager {
  private readonly overlays = new Map<string, OverlayEntry>();
  private readonly abortController = new AbortController();
  private isDestroyed = false;

  constructor() {
    const handleViewportChange = (): void => {
      this.overlays.forEach((entry) => this.applyLayout(entry));
    };
    window.addEventListener('resize', handleViewportChange, {
      signal: this.abortController.signal,
    });
    window.addEventListener('orientationchange', handleViewportChange, {
      signal: this.abortController.signal,
    });
  }

  /** Creates an overlay and its toggle/close/(optional) fullscreen chrome. */
  createOverlay(options: ChatOverlayManagerOptions): void {
    if (this.overlays.has(options.overlayId)) {
      throw new Error(
        `ChatOverlayManager: overlay "${options.overlayId}" already exists`,
      );
    }
    ensureManagerStylesInjected();

    const container = document.createElement('div');
    container.setAttribute('data-dial-overlay-container', options.overlayId);
    setStyles(container, {
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
      background: '#ffffff',
    });

    const header = document.createElement('div');
    setStyles(header, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      padding: '8px',
    });

    const closeButton = createButton(
      options.closeButtonAriaLabel ?? 'Collapse',
      ICON_CLOSE,
    );
    header.appendChild(closeButton);

    let fullscreenButton: HTMLButtonElement | undefined;
    if (options.allowFullscreen) {
      fullscreenButton = createButton(
        options.fullscreenButtonAriaLabel ?? 'Open full screen',
        ICON_FULLSCREEN,
      );
      header.appendChild(fullscreenButton);
    }

    const body = document.createElement('div');
    setStyles(body, { flex: '1', minHeight: '0' });

    container.appendChild(header);
    container.appendChild(body);
    document.body.appendChild(container);

    const overlay = new ChatOverlay(body, options);
    if (options.allowFullscreen) {
      overlay.allowFullscreen();
    }

    const toggleButton = createButton(
      options.toggleButtonAriaLabel ?? 'Open chat',
      ICON_TOGGLE,
    );
    document.body.appendChild(toggleButton);

    const entry: OverlayEntry = {
      overlay,
      container,
      toggleButton,
      closeButton,
      fullscreenButton,
      options,
    };
    this.overlays.set(options.overlayId, entry);

    toggleButton.addEventListener('click', () =>
      this.showOverlay(options.overlayId),
    );
    closeButton.addEventListener('click', () =>
      this.hideOverlay(options.overlayId),
    );
    fullscreenButton?.addEventListener('click', () => {
      void this.openFullscreen(options.overlayId);
    });

    this.applyLayout(entry);
    this.hideOverlay(options.overlayId);
  }

  /** Shows the overlay panel and hides its toggle button. */
  showOverlay(overlayId: string): void {
    const entry = this.getEntry(overlayId);
    entry.container.style.display = 'flex';
    entry.toggleButton.style.display = 'none';
  }

  /** Hides the overlay panel and shows its toggle button. */
  hideOverlay(overlayId: string): void {
    const entry = this.getEntry(overlayId);
    entry.container.style.display = 'none';
    entry.toggleButton.style.display = 'inline-flex';
  }

  /** Destroys the overlay and removes its DOM (container, toggle button). */
  removeOverlay(overlayId: string): void {
    const entry = this.getEntry(overlayId);
    entry.overlay.destroy();
    entry.container.remove();
    entry.toggleButton.remove();
    this.overlays.delete(overlayId);
  }

  /** Resolves once `overlayId` reaches `READY_TO_INTERACT`. */
  ready(overlayId: string): Promise<boolean> {
    return this.getEntry(overlayId).overlay.ready();
  }

  /** Fetches the active conversation's messages for `overlayId`. */
  getMessages(overlayId: string): Promise<GetMessagesResponse> {
    return this.getEntry(overlayId).overlay.getMessages();
  }

  /** Sends a new message in `overlayId`'s active conversation. */
  sendMessage(
    overlayId: string,
    content: string,
  ): Promise<SendMessageResponse> {
    return this.getEntry(overlayId).overlay.sendMessage(content);
  }

  /** Sets `overlayId`'s message input content. */
  setInputContent(overlayId: string, content: string): Promise<void> {
    return this.getEntry(overlayId).overlay.setInputContent(content);
  }

  /** Sets `overlayId`'s active conversation system prompt. */
  setSystemPrompt(
    overlayId: string,
    systemPrompt: string,
  ): Promise<SetSystemPromptResponse> {
    return this.getEntry(overlayId).overlay.setSystemPrompt(systemPrompt);
  }

  /** Sets `overlayId`'s active conversation temperature. */
  setTemperature(
    overlayId: string,
    temperature: number,
  ): Promise<SetTemperatureResponse> {
    return this.getEntry(overlayId).overlay.setTemperature(temperature);
  }

  /** Updates theme/model/conversation options for `overlayId`. */
  setOverlayOptions(
    overlayId: string,
    options: Partial<
      Pick<ChatOverlayOptions, 'theme' | 'modelId' | 'overlayConversationId'>
    >,
  ): Promise<SetOverlayOptionsResponse> {
    return this.getEntry(overlayId).overlay.setOverlayOptions(options);
  }

  /** Subscribes to an event from `overlayId`'s embedded app. */
  subscribe<T = unknown>(
    overlayId: string,
    eventType: OverlayEventType,
    callback: (payload: T) => void,
  ): () => void {
    return this.getEntry(overlayId).overlay.subscribe(eventType, callback);
  }

  /** Requests fullscreen for `overlayId`. */
  openFullscreen(overlayId: string): Promise<void> {
    return this.getEntry(overlayId).overlay.openFullscreen();
  }

  /** Destroys every overlay and removes global `resize`/`orientationchange` listeners. */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    this.overlays.forEach((entry) => {
      entry.overlay.destroy();
      entry.container.remove();
      entry.toggleButton.remove();
    });
    this.overlays.clear();
    this.abortController.abort();
  }

  private getEntry(overlayId: string): OverlayEntry {
    const entry = this.overlays.get(overlayId);
    if (!entry) {
      throw new Error(`ChatOverlayManager: unknown overlay id "${overlayId}"`);
    }
    return entry;
  }

  private applyLayout(entry: OverlayEntry): void {
    const { options, container, toggleButton } = entry;
    const position = options.position ?? OverlayPosition.RightBottom;
    const zIndex = String(options.zIndex ?? DEFAULT_Z_INDEX);

    setStyles(toggleButton, {
      position: 'fixed',
      zIndex,
      ...POSITION_STYLES[position],
    });
    setStyles(container, { position: 'fixed', zIndex });

    const isMobileViewport = window.innerWidth <= MOBILE_BREAKPOINT_PX;
    if (isMobileViewport) {
      setStyles(container, {
        insetInlineStart: '0',
        insetInlineEnd: '0',
        insetBlockStart: '0',
        insetBlockEnd: '0',
        width: '100%',
        height: '100%',
        borderRadius: '0',
      });
      return;
    }

    setStyles(container, {
      width: toCssSize(options.width ?? DEFAULT_WIDTH),
      height: toCssSize(options.height ?? DEFAULT_HEIGHT),
      ...POSITION_STYLES[position],
    });
  }
}

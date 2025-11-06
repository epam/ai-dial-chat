export class AuthWindowLocationLike {
  protected authWindow: Window | undefined | null;
  protected resolve: (() => void) | null = null;
  protected reject: (() => void) | null = null;

  constructor(url: string, isSignInInSameWindow?: boolean) {
    this.authWindow = window.open(
      url,
      isSignInInSameWindow ? '_self' : '_blank',
    );

    if (this.authWindow == null) {
      this.reject?.();
      return;
    }
    this.authWindow.onload = this.resolve;
    this.authWindow.onerror = this.reject;
    this.authWindow.onabort = this.reject;
    this.authWindow.opener = null;
  }

  protected readiness = new Promise<void>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

  protected get loc() {
    return this.authWindow?.location;
  }

  get href() {
    try {
      return this.loc?.href ?? '';
    } catch {
      return '';
    }
  }

  get ready() {
    return this.readiness;
  }

  destroy() {
    this.reject?.();
    this.resolve = null;
    this.reject = null;
    this.authWindow?.close();
  }
}

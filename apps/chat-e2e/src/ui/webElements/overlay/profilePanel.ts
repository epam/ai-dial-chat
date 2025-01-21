import { HeaderSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Footer } from '@/src/ui/webElements/footer';
import { Locator, Page } from '@playwright/test';

export class ProfilePanel extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, HeaderSelectors.profilePanel, parentLocator);
  }

  public settings = this.getChildElementBySelector(HeaderSelectors.settings);
  public logout = this.getChildElementBySelector(HeaderSelectors.overlayLogout);
  public username = this.getChildElementBySelector(HeaderSelectors.username);
  public avatar = this.getChildElementBySelector(HeaderSelectors.avatar);

  private footer!: Footer;

  getFooter(): Footer {
    if (!this.footer) {
      this.footer = new Footer(this.page, this.rootLocator);
    }
    return this.footer;
  }
}

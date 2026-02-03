import { BasePage } from '@/src/ui/pages/basePage';
import { NotFound } from '@/src/ui/webElements';

export class DialErrorPage extends BasePage {
  private notFound!: NotFound;

  public getNotFound(): NotFound {
    if (!this.notFound) {
      this.notFound = new NotFound(this.page);
    }
    return this.notFound;
  }
}

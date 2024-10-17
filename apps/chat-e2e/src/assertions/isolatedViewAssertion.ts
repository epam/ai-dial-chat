import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { MoreInfo } from '@/src/ui/webElements';

export class IsolatedViewAssertion extends BaseAssertion {
  readonly isolatedView: MoreInfo;

  constructor(isolatedView: MoreInfo) {
    super();
    this.isolatedView = isolatedView;
  }

  public async assertModelIcon(expectedIcon: string) {
    await super.assertEntityIcon(
      await this.isolatedView.getEntityIcon(),
      expectedIcon,
    );
  }
}

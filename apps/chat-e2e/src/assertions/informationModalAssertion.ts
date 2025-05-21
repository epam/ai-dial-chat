import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedConstants } from '@/src/testData';
import { InformationModal } from '@/src/ui/webElements';

export class InformationModalAssertion extends BaseAssertion {
  private informationModal: InformationModal;

  constructor(informationModal: InformationModal) {
    super();
    this.informationModal = informationModal;
  }

  public async assertFields(options: {
    author?: string;
    createdDate: string;
    lastUpdatedDate?: string;
  }) {
    await this.assertElementState(this.informationModal, 'visible');
    if (options?.lastUpdatedDate) {
      await this.assertElementText(
        this.informationModal.lastUpdatedLabel,
        ExpectedConstants.informationModalLastUpdatedLabel,
      );
      await this.assertElementText(
        this.informationModal.lastUpdatedValue,
        options.lastUpdatedDate,
      );
    } else {
      await this.assertElementState(
        this.informationModal.lastUpdatedLabel,
        'hidden',
      );
    }
    await this.assertElementText(
      this.informationModal.createdDateLabel,
      ExpectedConstants.informationModalCreatedDateLabel,
    );

    await this.assertElementText(
      this.informationModal.createdDateValue,
      options.createdDate,
    );
    if (options?.author) {
      await this.assertElementText(
        this.informationModal.authorLabel,
        ExpectedConstants.informationModalAuthorLabel,
      );
      await this.assertElementText(
        this.informationModal.authorValue,
        options.author,
      );
    } else {
      await this.assertElementState(
        this.informationModal.authorValue,
        'hidden',
      );
    }
  }
}

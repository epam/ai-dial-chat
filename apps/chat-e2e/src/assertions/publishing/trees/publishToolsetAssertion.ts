import { PublishEntityAssertion } from '@/src/assertions';
import { CheckboxState, ElementState, ExpectedConstants } from '@/src/testData';
import { PublishToolsetsTree } from '@/src/ui/webElements/entityTree';

export class PublishToolsetAssertion<
  K extends PublishToolsetsTree,
> extends PublishEntityAssertion<K> {
  public async assertToolsetCredentials(attributes: {
    expectedState: ElementState;
    expectedCheckboxState?: CheckboxState;
  }) {
    await this.assertElementState(
      this.publishEntities.credentials,
      attributes.expectedState,
    );
    if (attributes.expectedState === 'visible') {
      await this.assertElementText(
        this.publishEntities.credentials,
        ExpectedConstants.credentials,
      );
      await this.assertElementState(
        this.publishEntities.credentialsCheckbox,
        'visible',
      );
      await this.assertElementState(
        this.publishEntities.credentialsIcon,
        'visible',
      );
      if (attributes.expectedCheckboxState) {
        await this.assertCheckboxState(
          this.publishEntities.credentialsCheckbox,
          attributes.expectedCheckboxState,
        );
      }
    }
  }
}

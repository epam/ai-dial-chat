import { DialAIEntityModel } from '@/chat/types/models';
import { MarketplaceSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement } from '@/src/ui/webElements';
import { ApplicationDetailsModal } from '@/src/ui/webElements/marketplace/applicationDetailsModal';
<<<<<<< HEAD
import { ModelsUtil } from '@/src/utils';
=======
>>>>>>> development
import { Locator, Page } from '@playwright/test';

export class Applications extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceSelectors.applications, parentLocator);
  }

  private applicationDetailsModal!: ApplicationDetailsModal;

  getApplicationDetailsModal(): ApplicationDetailsModal {
    if (!this.applicationDetailsModal) {
      this.applicationDetailsModal = new ApplicationDetailsModal(this.page);
    }
    return this.applicationDetailsModal;
  }

  public applications = this.getChildElementBySelector(
    MarketplaceSelectors.application,
  );

  public applicationNames = this.getChildElementBySelector(
    MarketplaceSelectors.applicationName,
  );

  public applicationName = (name: string) =>
    new BaseElement(
      this.page,
      `${MarketplaceSelectors.applicationName}:text-is('${name}')`,
    ).getElementLocator();

  public async isApplicationUsed(entity: DialAIEntityModel): Promise<boolean> {
    let isApplicationVisible = false;
    const entityLocator = this.applicationName(entity.name);
    //open entity details modal if it is visible
    if (await entityLocator.isVisible()) {
      //open application details modal
      await entityLocator.click();
      const appDetailsModal = this.getApplicationDetailsModal();
      //if entity has more than one version in the config
<<<<<<< HEAD
      if (entity.version && ModelsUtil.getEntitiesByNameCount(entity) > 1) {
=======
      if (entity.version) {
>>>>>>> development
        //check if current version match expected
        const currentVersion = await appDetailsModal.applicationVersion
          .getElementInnerContent()
          .then((value) => value.replace('version:\n', '').replace('v: ', ''));
        //select version from dropdown menu if it does not match the current one
        if (currentVersion !== entity.version) {
<<<<<<< HEAD
          await appDetailsModal.versionMenuTrigger.click();
          await appDetailsModal
            .getVersionDropdownMenu()
            .selectMenuOption(entity.version);
        }
      }
      await appDetailsModal.clickUseButton();
      isApplicationVisible = true;
=======
          const menuTrigger = appDetailsModal.versionMenuTrigger;
          //check if version menu is available
          if (await menuTrigger.isVisible()) {
            await menuTrigger.click();
            //check if menu includes version
            const version = appDetailsModal
              .getVersionDropdownMenu()
              .menuOption(entity.version);
            if (await version.isVisible()) {
              await appDetailsModal
                .getVersionDropdownMenu()
                .selectMenuOption(entity.version);
              await appDetailsModal.clickUseButton();
              isApplicationVisible = true;
            } else {
              await appDetailsModal.closeButton.click();
            }
          } else {
            await appDetailsModal.closeButton.click();
          }
        } else {
          await appDetailsModal.clickUseButton();
          isApplicationVisible = true;
        }
      } else {
        await appDetailsModal.clickUseButton();
        isApplicationVisible = true;
      }
>>>>>>> development
    }
    return isApplicationVisible;
  }

  public async getApplicationIcons() {
    return this.getElementIcons(
      this.applications,
      MarketplaceSelectors.applicationName,
    );
  }
}

import { DialAIEntityModel } from '@/chat/types/models';
import { ToolsetModel } from '@/chat/types/toolsets';
import { API, ExpectedConstants } from '@/src/testData';
import { Attributes, Tags } from '@/src/ui/domData';
import {
  ChatSelectors,
  IconSelectors,
  MenuSelectors,
} from '@/src/ui/selectors';
import { MarketplaceEntitySelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { BaseElement, DropdownMenu } from '@/src/ui/webElements';
import { EntityDetailsModal } from '@/src/ui/webElements/marketplace/entityDetailsModal';
import { RegexUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export enum FoundMarketplaceEntities {
  suggested,
  filtered,
}

export interface MarketplaceEntityProperties {
  name: string;
  version?: string;
  isSuggested: boolean;
  isWorkspaceEntity: boolean;
  isEditable: boolean;
}

export class MarketplaceEntities extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, MarketplaceEntitySelectors.entity, parentLocator);
  }

  private entityDetailsModal!: EntityDetailsModal;
  private entityDropdownMenu!: DropdownMenu;

  getEntityDetailsModal(): EntityDetailsModal {
    if (!this.entityDetailsModal) {
      this.entityDetailsModal = new EntityDetailsModal(this.page);
    }
    return this.entityDetailsModal;
  }

  getEntityDropdownMenu(): DropdownMenu {
    if (!this.entityDropdownMenu) {
      this.entityDropdownMenu = new DropdownMenu(this.page);
    }
    return this.entityDropdownMenu;
  }

  public entityNames = this.getChildElementBySelector(
    MarketplaceEntitySelectors.entityName,
  );

  public iconContainer = this.getChildElementBySelector(
    MarketplaceEntitySelectors.iconContainer,
  );

  public entityName = (name: string) =>
    new BaseElement(
      this.page,
      `${MarketplaceEntitySelectors.entityName}:text-is('${RegexUtil.escapeRegexChars(name)}')`,
    ).getElementLocator();

  public entityVersion = (version: string) =>
    this.page.locator(MarketplaceEntitySelectors.version).filter({
      hasText: new RegExp(`^\\s*${RegexUtil.escapeRegexChars(version)}\\s*$`),
    });

  public entityVersionWithPrefix = (version: string) =>
    this.page.locator(MarketplaceEntitySelectors.version).filter({
      hasText: new RegExp(
        `^\\s*${RegexUtil.escapeRegexChars(`${ExpectedConstants.versionPrefix}${version}`)}\\s*$`,
      ),
    });

  public getEntity = (entity: DialAIEntityModel | ToolsetModel | string) => {
    let entityLocator;
    if (typeof entity === 'string') {
      entityLocator = this.rootLocator.filter({ has: this.entityName(entity) });
    } else {
      //if entity has version in the config
      if (entity.version) {
        entityLocator = this.rootLocator
          .filter({
            has: this.entityName(entity.name),
          })
          .filter({
            has: this.entityVersion(entity.version).or(
              this.entityVersionWithPrefix(entity.version),
            ),
          });
      } else {
        //init entity locator if no version is available in the config
        entityLocator = this.rootLocator.filter({
          has: this.entityName(entity.name),
        });
      }
    }
    return this.createElementFromLocator(entityLocator);
  };

  public getEntityDescription(
    entity: DialAIEntityModel | ToolsetModel | string | BaseElement,
  ) {
    return this.getEntityDescriptionContainer(entity).getChildElementBySelector(
      Tags.p,
    );
  }

  public getEntityDescriptionContainer(
    entity: DialAIEntityModel | ToolsetModel | string | BaseElement,
  ) {
    const element =
      entity instanceof BaseElement ? entity : this.getEntity(entity);
    return this.createElementFromLocator(
      element
        .getChildElementBySelector(MarketplaceEntitySelectors.description)
        .getChildElementBySelector(`${Attributes.visible}=true`)
        .getElementLocator()
        .filter({ has: this.page.locator(Tags.p) }),
    );
  }

  public getEntityVersion(entityElement: BaseElement) {
    return entityElement.getChildElementBySelector(
      MarketplaceEntitySelectors.version,
    );
  }

  public getEntityName(entityElement: BaseElement) {
    return entityElement.getChildElementBySelector(
      MarketplaceEntitySelectors.entityName,
    );
  }

  public getEntityElementWithVersion(
    entityElement: BaseElement,
    version?: string,
  ) {
    return entityElement.getElementLocator().filter({
      has: this.entityVersion(version!).or(
        this.entityVersionWithPrefix(version!),
      ),
    });
  }

  public getEntityTopicsContainer(entityElement: BaseElement) {
    return entityElement.getChildElementBySelector(
      MarketplaceEntitySelectors.topicsContainer,
    );
  }

  public getEntityVisibleTopics(entityElement: BaseElement) {
    return this.getEntityTopicsContainer(
      entityElement,
    ).getChildElementBySelector(MarketplaceEntitySelectors.topic);
  }

  public getEntityHiddenTopics(entityElement: BaseElement) {
    return this.getEntityTopicsContainer(
      entityElement,
    ).getChildElementBySelector(MarketplaceEntitySelectors.hiddenTopics);
  }

  public getEntityElementDotsMenu(entityElement: BaseElement) {
    return entityElement.getChildElementBySelector(MenuSelectors.menuTrigger);
  }

  public getEntityElementCredentials(entityElement: BaseElement) {
    return entityElement.getChildElementBySelector(
      MarketplaceEntitySelectors.credsLabel,
    );
  }

  public getEntityElementAddBookmarkIcon(entityElement: BaseElement) {
    return entityElement
      .getChildElementBySelector(MarketplaceEntitySelectors.addBookmarkIcon)
      .getChildElementBySelector(Tags.svg);
  }

  public getEntityElementRemoveBookmarkIcon(entityElement: BaseElement) {
    return entityElement
      .getChildElementBySelector(MarketplaceEntitySelectors.removeBookmarkIcon)
      .getChildElementBySelector(Tags.svg);
  }

  public async entityWithVersionToSet(
    entity: DialAIEntityModel | ToolsetModel,
  ) {
    if (entity.version) {
      const entityNameLocator = this.rootLocator.filter({
        has: this.entityName(entity.name),
      });
      if (await entityNameLocator.isVisible()) {
        return entityNameLocator;
      }
    }
  }

  public getEntityPencilIcon(entityElement: BaseElement) {
    return entityElement
      .getChildElementBySelector(MarketplaceEntitySelectors.pencilIcon)
      .getChildElementBySelector(Tags.svg);
  }

  public getEntityArrowIcon(entityElement: BaseElement) {
    return entityElement
      .getChildElementBySelector(MarketplaceEntitySelectors.arrowIcon)
      .getChildElementBySelector(Tags.svg);
  }

  public getAppExternalIcon(entityElement: BaseElement) {
    return entityElement
      .getChildElementBySelector(MarketplaceEntitySelectors.iconContainer)
      .getChildElementBySelector(IconSelectors.externalAppIcon);
  }

  public getNotAvailableEntityElement = (reference: string) => {
    const entityLocator = this.rootLocator.filter({
      has: this.entityName(reference),
    });
    return this.createElementFromLocator(entityLocator);
  };

  public getToolsetDefaultIcon(entityElement: BaseElement) {
    return entityElement
      .getChildElementBySelector(ChatSelectors.iconSelector)
      .getChildElementBySelector(IconSelectors.defaultToolsetIcon);
  }

  public async getEntityNames() {
    return this.entityNames.getElementsInnerContent();
  }

  public async getEntityIcons() {
    return this.getElementIcons(this);
  }

  public async getEntityIcon(entityElement: BaseElement) {
    return this.iconContainer.getElementIcon(entityElement.getElementLocator());
  }

  public async addEntityToWorkspace(entityElement: BaseElement) {
    const respPromise = this.page.waitForResponse(
      (r) =>
        r.url().includes(API.installedDeploymentsHost()) && r.status() === 200,
    );
    await this.getEntityElementAddBookmarkIcon(entityElement).click();
    await respPromise;
  }
}

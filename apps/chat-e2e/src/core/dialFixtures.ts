import config from '../../config/chat.playwright.config';
import {
  DialHomePage,
  EntityEditorPage,
  FilesManagerPage,
  MarketplacePage,
} from '../ui/pages';
import {
  AgentInfo,
  AttachFilesModal,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  ChatNotFound,
  ConfirmationPopup,
  ConversationSettingsModal,
  ConversationToCompare,
  CustomAppEditorAppSettingsPreview,
  CustomAppEditorAppSettingsPreviewBody,
  CustomAppEditorContainer,
  CustomAppEditorViewForm,
  DragFile,
  Dropdown,
  EntityDetailsModal,
  EntityEditorEntitySettingsCardPreview,
  EntityEditorEntitySettingsCardPreviewBody,
  EntityEditorEntitySettingsPreviewChat,
  EntityEditorGeneralForm,
  EntityEditorGeneralInfoPreview,
  EntityEditorHeader,
  EntityEditorPreviewCard,
  ExternalAppEditorContainer,
  ExternalAppEditorViewForm,
  FileDropArea,
  FileModalSection,
  FilesManager,
  FilesManagerCollapsibleSidebar,
  FilesManagerContainer,
  FilesManagerGrid,
  FilesManagerModal,
  FilesManagerToolbar,
  FoldersTree,
  InformationModal,
  ListboxMenu,
  MessageTemplateModal,
  PromptBar,
  PublishingFilter,
  PublishingRules,
  SelectFolderModal,
  SendMessage,
  ShareAppModal,
  ToolsetEditorContainer,
  ToolsetEditorViewForm,
  TopicsTooltip,
} from '../ui/webElements';
import { ChatSettingsTooltip } from '../ui/webElements/chatSettingsTooltip';

import {
  AccountSettingsAssertion,
  AgentInfoAssertion,
  AgentSettingAssertion,
  ChatAssertion,
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  ConfirmationDialogAssertion,
  ConversationAssertion,
  ConversationInfoTooltipAssertion,
  ConversationToCompareAssertion,
  DownloadAssertion,
  EntityEditorPreviewCardAssertion,
  EntityEditorPreviewToggleAssertion,
  EntityTreeAssertion,
  FilesManagerGridAssertion,
  FolderAssertion,
  FooterAssertion,
  MenuAssertion,
  PlaybackAssertion,
  PromptAssertion,
  PromptListAssertion,
  PromptModalAssertion,
  PublishEntityAssertion,
  PublishFileAssertion,
  PublishFolderAssertion,
  PublishingRequestDialogAssertion,
  ReplaceConfirmationModalAssertion,
  SendMessageAssertion,
  ShareApiAssertion,
  ShareAppModalAssertion,
  ShareModalAssertion,
  SideBarAssertion,
  TalkToAgentDialogAssertion,
  ToastAssertion,
  ToolsetAuthAssertion,
  TooltipAssertion,
  VariableModalAssertion,
} from '@/src/assertions';
import { InputAttachmentsAssertions } from '@/src/assertions/InputAttachmentsAssertions';
import { PublicationApiAssertion } from '@/src/assertions/api/publicationApiAssertion';
import { ConfirmationPopupAssertion } from '@/src/assertions/common/confirmationPopupAssertion';
import { EntityDetailsModalAssertion } from '@/src/assertions/entityDetailsModalAssertion';
import { EntityEditorHeaderAssertion } from '@/src/assertions/entityEditorHeaderAssertion';
import { InformationModalAssertion } from '@/src/assertions/informationModalAssertion';
import { LocalStorageAssertion } from '@/src/assertions/localStorageAssertion';
import { ManageAttachmentFoldersAssertion } from '@/src/assertions/manageAttachmentFoldersAssertion';
import { ManageAttachmentsAssertion } from '@/src/assertions/manageAttachmentsAssertion';
import { MessageTemplateModalAssertion } from '@/src/assertions/messageTemplateModalAssertion';
import { PromptPreviewModalAssertion } from '@/src/assertions/promptPreviewModalAssertion';
import { PublishingRulesAssertion } from '@/src/assertions/publishing/publishingRulesAssertion';
import { RenameConversationModalAssertion } from '@/src/assertions/renameConversationModalAssertion';
import { SelectFolderModalAssertion } from '@/src/assertions/selectFolderModalAssertion';
import { SettingsModalAssertion } from '@/src/assertions/settingsModalAssertion';
import { SideBarConversationAssertion } from '@/src/assertions/sideBarConversationAssertion';
import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { ToolsetEditorViewFormAssertion } from '@/src/assertions/toolsetEditorViewFormAssertion';
import test from '@/src/core/baseFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  ApplicationApiHelper,
  ChatApiHelper,
  FileApiHelper,
  IconApiHelper,
  ShareApiHelper,
  ToolsetApiHelper,
} from '@/src/testData/api';
import { ItemApiHelper } from '@/src/testData/api/itemApiHelper';
import { ModelApiHelper } from '@/src/testData/api/modelApiHelper';
import { PublicationApiHelper } from '@/src/testData/api/publicationApiHelper';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { DialErrorPage } from '@/src/ui/pages/dialErrorPage';
import { AccountSettings } from '@/src/ui/webElements/accountSettings';
import { AgentSettings } from '@/src/ui/webElements/agentSettings';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { Banner } from '@/src/ui/webElements/banner';
import { Compare } from '@/src/ui/webElements/compare';
import { ConfirmationDialog } from '@/src/ui/webElements/confirmationDialog';
import { DropdownCheckboxMenu } from '@/src/ui/webElements/dropdownCheckboxMenu';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import {
  AttachFilesTree,
  ConversationsTree,
  FolderConversations,
  FolderPrompts,
  Folders,
  OrganizationConversationsTree,
  PromptsTree,
  PublishApplicationsTree,
  PublishConversationsTree,
  PublishFolder,
  PublishFolderConversations,
  PublishPromptsTree,
  SharedFolderConversations,
  SharedWithMeConversationsTree,
} from '@/src/ui/webElements/entityTree';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree/publication/publishFilesTree';
import { OrganizationPromptsTree } from '@/src/ui/webElements/entityTree/sidebar/organizationPromptsTree';
import { ErrorPopup } from '@/src/ui/webElements/errorPopup';
import { Filter } from '@/src/ui/webElements/filter';
import { Footer } from '@/src/ui/webElements/footer';
import { Header } from '@/src/ui/webElements/header';
import { ImportExportLoader } from '@/src/ui/webElements/importExportLoader';
import { InputAttachments } from '@/src/ui/webElements/inputAttachments';
import { Marketplace } from '@/src/ui/webElements/marketplace/marketplace';
import { MarketplaceContainer } from '@/src/ui/webElements/marketplace/marketplaceContainer';
import { MarketplaceEntities } from '@/src/ui/webElements/marketplace/marketplaceEntities';
import { MarketplaceEntitiesSection } from '@/src/ui/webElements/marketplace/marketplaceEntitiesSection';
import { MarketplaceFilter } from '@/src/ui/webElements/marketplace/marketplaceFilter';
import { MarketplaceHeader } from '@/src/ui/webElements/marketplace/marketplaceHeader';
import { MarketplaceSidebar } from '@/src/ui/webElements/marketplace/marketplaceSidebar';
import { ModelInfoTooltip } from '@/src/ui/webElements/modelInfoTooltip';
import { NavigationPanel } from '@/src/ui/webElements/navigationPanel';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { PromptModalDialog } from '@/src/ui/webElements/promptModalDialog';
import { PromptPreviewModalWindow } from '@/src/ui/webElements/promptPreviewModalWindow';
import { PublishingRequestDialog } from '@/src/ui/webElements/publishingRequestDialog';
import { RenameConversationModal } from '@/src/ui/webElements/renameConversationModal';
import { ReplaceConfirmationModal } from '@/src/ui/webElements/replaceConfirmationModal';
import { ReplaceConfirmationModalConversations } from '@/src/ui/webElements/replaceConfirmationModalConversations';
import { ReplaceConfirmationModalFolders } from '@/src/ui/webElements/replaceConfirmationModalFolders';
import { Search } from '@/src/ui/webElements/search';
import { SettingsModal } from '@/src/ui/webElements/settingsModal';
import { ShareModal } from '@/src/ui/webElements/shareModal';
import { TalkToAgentDialog } from '@/src/ui/webElements/talkToAgentDialog';
import { TemperatureSlider } from '@/src/ui/webElements/temperatureSlider';
import { Toast } from '@/src/ui/webElements/toast';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { UploadFromDeviceModal } from '@/src/ui/webElements/uploadFromDeviceModal';
import { VariableModalDialog } from '@/src/ui/webElements/variableModalDialog';
import { BucketUtil } from '@/src/utils';
import { CustomApplicationPublishingUtil } from '@/src/utils/customApplicationPublishingUtil';
import path from 'path';
import { APIRequestContext } from 'playwright-core';
import * as process from 'process';

export const stateFilePath = (index: number) =>
  path.join(__dirname, `../../auth/desktopUser${index}.json`);

const dialTest = test.extend<{
  beforeTestCleanup: string;
  dialHomePage: DialHomePage;
  dialErrorPage: DialErrorPage;
  marketplacePage: MarketplacePage;
  filesManagerPage: FilesManagerPage;
  entityEditorPage: EntityEditorPage;
  entityEditorHeader: EntityEditorHeader;
  entityEditorGeneralForm: EntityEditorGeneralForm;
  entityEditorGeneralInfoPreview: EntityEditorGeneralInfoPreview;
  entityEditorGeneralInfoPreviewCard: EntityEditorPreviewCard;
  appContainer: AppContainer;
  marketplaceContainer: MarketplaceContainer;
  customAppEditorContainer: CustomAppEditorContainer;
  customAppEditorViewForm: CustomAppEditorViewForm;
  customAppEditorAppSettingsPreview: CustomAppEditorAppSettingsPreview;
  customAppEditorAppSettingsPreviewBody: CustomAppEditorAppSettingsPreviewBody;
  customAppEditorAppSettingsPreviewChat: EntityEditorEntitySettingsPreviewChat;
  externalAppEditorContainer: ExternalAppEditorContainer;
  externalAppEditorViewForm: ExternalAppEditorViewForm;
  externalAppEditorAppSettingsPreview: EntityEditorEntitySettingsCardPreview;
  externalAppEditorAppSettingsPreviewBody: EntityEditorEntitySettingsCardPreviewBody;
  externalAppEditorAppSettingsPreviewCard: EntityEditorPreviewCard;
  toolsetEditorContainer: ToolsetEditorContainer;
  toolsetEditorViewForm: ToolsetEditorViewForm;
  toolsetEditorSettingsPreview: EntityEditorEntitySettingsCardPreview;
  toolsetEditorSettingsPreviewBody: EntityEditorEntitySettingsCardPreviewBody;
  toolsetEditorSettingsPreviewCard: EntityEditorPreviewCard;
  marketplaceSidebar: MarketplaceSidebar;
  marketplaceFilter: MarketplaceFilter;
  marketplace: Marketplace;
  marketplaceEntitiesSection: MarketplaceEntitiesSection;
  marketplaceEntities: MarketplaceEntities;
  entityDetailsModal: EntityDetailsModal;
  marketplaceHeader: MarketplaceHeader;
  addAppDropdownMenu: DropdownMenu;
  entityEditorHeaderAssertion: EntityEditorHeaderAssertion;
  chatBar: ChatBar;
  navigationPanel: NavigationPanel;
  importExportLoader: ImportExportLoader;
  header: Header;
  accountSettings: AccountSettings;
  accountDropdownMenu: DropdownMenu;
  banner: Banner;
  promptBar: PromptBar;
  fileDropArea: FileDropArea;
  dragFile: DragFile;
  chat: Chat;
  footer: Footer;
  chatMessages: ChatMessages;
  editMessageInputAttachments: InputAttachments;
  sendMessage: SendMessage;
  attachmentDropdownMenu: DropdownMenu;
  sendMessageInputAttachments: InputAttachments;
  sendMessageInputAttachmentsAssertions: InputAttachmentsAssertions;
  editMessageInputAttachmentsAssertions: InputAttachmentsAssertions;
  conversations: ConversationsTree;
  prompts: PromptsTree;
  folderConversations: FolderConversations;
  folderPrompts: FolderPrompts;
  organizationFolderPrompts: FolderPrompts;
  organizationConversations: OrganizationConversationsTree;
  organizationPrompts: OrganizationPromptsTree;
  organizationFolderConversations: Folders;
  conversationSettingsModal: ConversationSettingsModal;
  talkToAgentDialog: TalkToAgentDialog;
  talkToAgents: MarketplaceEntities;
  agentSettings: AgentSettings;
  temperatureSlider: TemperatureSlider;
  agentInfo: AgentInfo;
  conversationDropdownMenu: DropdownMenu;
  folderDropdownMenu: DropdownMenu;
  promptDropdownMenu: DropdownMenu;
  confirmationDialog: ConfirmationDialog;
  replaceConfirmationModal: ReplaceConfirmationModal;
  promptModalDialog: PromptModalDialog;
  renameConversationModal: RenameConversationModal;
  renameConversationModalAssertion: RenameConversationModalAssertion;
  variableModalDialog: VariableModalDialog;
  chatHeader: ChatHeader;
  chatHeaderVersionDropdownMenu: DropdownMenu;
  chatHeaderDropdownMenu: DropdownMenu;
  modelInfoTooltip: ModelInfoTooltip;
  chatSettingsTooltip: ChatSettingsTooltip;
  compare: Compare;
  compareConversation: ConversationToCompare;
  rightChatHeader: ChatHeader;
  leftChatHeader: ChatHeader;
  tooltip: Tooltip;
  topicsTooltip: TopicsTooltip;
  errorPopup: ErrorPopup;
  playbackControl: PlaybackControl;
  shareModal: ShareModal;
  shareAppModal: ShareAppModal;
  chatBarSearch: Search;
  promptBarSearch: Search;
  chatFilter: Filter;
  promptFilter: Filter;
  chatFilterDropdownMenu: DropdownCheckboxMenu;
  promptFilterDropdownMenu: DropdownCheckboxMenu;
  modelApiHelper: ModelApiHelper;
  iconApiHelper: IconApiHelper;
  chatApiHelper: ChatApiHelper;
  fileApiHelper: FileApiHelper;
  adminFileApiHelper: FileApiHelper;
  additionalSecondShareUserFileApiHelper: FileApiHelper;
  itemApiHelper: ItemApiHelper;
  applicationApiHelper: ApplicationApiHelper;
  toolsetApiHelper: ToolsetApiHelper;
  browserStorageInjector: BrowserStorageInjector;
  apiInjector: ApiInjector;
  dataInjector: DataInjectorInterface;
  toast: Toast;
  additionalShareUserRequestContext: APIRequestContext;
  additionalSecondShareUserRequestContext: APIRequestContext;
  adminUserRequestContext: APIRequestContext;
  adminUserItemApiHelper: ItemApiHelper;
  adminShareApiHelper: ShareApiHelper;
  adminApplicationApiHelper: ApplicationApiHelper;
  mainUserShareApiHelper: ShareApiHelper;
  sharedWithMeConversations: SharedWithMeConversationsTree;
  sharedWithMeConversationDropdownMenu: DropdownMenu;
  sharedFolderConversations: SharedFolderConversations;
  sharedWithMeFolderDropdownMenu: DropdownMenu;
  additionalUserShareApiHelper: ShareApiHelper;
  additionalUserItemApiHelper: ItemApiHelper;
  additionalUserFileApiHelper: FileApiHelper;
  additionalUserApplicationApiHelper: ApplicationApiHelper;
  additionalUserModelApiHelper: ModelApiHelper;
  additionalSecondUserShareApiHelper: ShareApiHelper;
  additionalSecondUserItemApiHelper: ItemApiHelper;
  chatNotFound: ChatNotFound;
  attachFilesModal: AttachFilesModal;
  uploadFromDeviceModal: UploadFromDeviceModal;
  selectFolderModal: SelectFolderModal;
  selectFolders: Folders;
  attachedAllFiles: Folders;
  attachedOrganizationFiles: Folders;
  messageTemplateModal: MessageTemplateModal;
  manageAttachmentsAssertion: ManageAttachmentsAssertion;
  settingsModal: SettingsModal;
  publishingRequestDialog: PublishingRequestDialog;
  conversationsToPublishTree: PublishConversationsTree;
  filesToPublishTree: PublishFilesTree;
  promptsToPublishTree: PublishPromptsTree;
  appsToPublishTree: PublishApplicationsTree;
  folderConversationsToPublish: PublishFolderConversations;
  publicationApiHelper: PublicationApiHelper;
  adminPublicationApiHelper: PublicationApiHelper;
  additionalShareUserPublicationApiHelper: PublicationApiHelper;
  additionalSecondShareUserPublicationApiHelper: PublicationApiHelper;
  publishingRules: PublishingRules;
  publishingFilter: PublishingFilter;
  informationModal: InformationModal;
  listboxMenu: ListboxMenu;
  informationModalAssertion: InformationModalAssertion;
  conversationAssertion: ConversationAssertion;
  chatBarFolderAssertion: FolderAssertion<FolderConversations>;
  allFilesFolderAssertion: ManageAttachmentFoldersAssertion;
  organizationFoldersAssertion: ManageAttachmentFoldersAssertion;
  organizationConversationAssertion: SideBarConversationAssertion<OrganizationConversationsTree>;
  organizationPromptAssertion: SideBarEntityAssertion<OrganizationPromptsTree>;
  toastAssertion: ToastAssertion;
  downloadAssertion: DownloadAssertion;
  promptModalAssertion: PromptModalAssertion;
  tooltipAssertion: TooltipAssertion;
  confirmationDialogAssertion: ConfirmationDialogAssertion;
  chatBarAssertion: SideBarAssertion;
  promptBarFolderAssertion: FolderAssertion<FolderPrompts>;
  promptBarOrganizationFolderAssertion: FolderAssertion<FolderPrompts>;
  promptAssertion: PromptAssertion;
  promptBarAssertion: SideBarAssertion;
  accountSettingsAssertion: AccountSettingsAssertion;
  accountDropdownMenuAssertion: MenuAssertion;
  conversationDropdownMenuAssertion: MenuAssertion;
  promptDropdownMenuAssertion: MenuAssertion;
  folderDropdownMenuAssertion: MenuAssertion;
  settingsModalAssertion: SettingsModalAssertion;
  sendMessageAssertion: SendMessageAssertion;
  chatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  rightChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  leftChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  chatMessagesAssertion: ChatMessagesAssertion;
  footerAssertion: FooterAssertion;
  sendMessagePromptListAssertion: PromptListAssertion;
  systemPromptListAssertion: PromptListAssertion;
  variableModalAssertion: VariableModalAssertion;
  chatAssertion: ChatAssertion;
  agentSettingAssertion: AgentSettingAssertion;
  playbackAssertion: PlaybackAssertion;
  shareApiAssertion: ShareApiAssertion;
  shareModalAssertion: ShareModalAssertion<ShareModal>;
  shareAppModalAssertion: ShareAppModalAssertion;
  publishingRequestDialogAssertion: PublishingRequestDialogAssertion;
  selectFoldersAssertion: FolderAssertion<Folders>;
  selectFolderModalAssertion: SelectFolderModalAssertion;
  conversationInfoTooltipAssertion: ConversationInfoTooltipAssertion;
  agentInfoAssertion: AgentInfoAssertion;
  conversationToCompareAssertion: ConversationToCompareAssertion;
  publishingRequestFolderConversationAssertion: FolderAssertion<PublishFolder>;
  publishingRequestFolderPromptAssertion: PublishFolderAssertion<PublishFolder>;
  talkToAgentDialogAssertion: TalkToAgentDialogAssertion;
  publishConversationAssertion: PublishEntityAssertion<PublishConversationsTree>;
  publishFileTreeAssertion: PublishFileAssertion<PublishFilesTree>;
  publishPromptsTreeAssertion: PublishEntityAssertion<PublishPromptsTree>;
  appToPublishAssertion: PublishEntityAssertion<PublishApplicationsTree>;
  folderToPublishAssertion: PublishFolderAssertion<PublishFolderConversations>;
  organizationFolderConversationAssertions: FolderAssertion<Folders>;
  messageTemplateModalAssertion: MessageTemplateModalAssertion;
  entityVersionsDropdownMenuAssertion: MenuAssertion;
  addAppDropdownMenuAssertion: MenuAssertion;
  sharedWithMeConversationAssertion: SideBarConversationAssertion<SharedWithMeConversationsTree>;
  localStorageAssertion: LocalStorageAssertion;
  promptPreviewModal: PromptPreviewModalWindow;
  promptPreviewVersionDropdownMenu: DropdownMenu;
  promptPreviewModalAssertion: PromptPreviewModalAssertion;
  entityDetailsModalAssertion: EntityDetailsModalAssertion;
  attachAllFilesTreeAssertion: EntityTreeAssertion<AttachFilesTree>;
  adminCustomApplicationPublishingUtil: CustomApplicationPublishingUtil;
  customApplicationPublishingUtil: CustomApplicationPublishingUtil;
  organizationFolderPromptAssertions: FolderAssertion<Folders>;
  publishingRulesAssertion: PublishingRulesAssertion;
  publicationApiAssertion: PublicationApiAssertion;
  additionalShareUserPublicationApiAssertion: PublicationApiAssertion;
  additionalSecondShareUserPublicationApiAssertion: PublicationApiAssertion;
  entityEditorGeneralInfoPreviewToggleAssertion: EntityEditorPreviewToggleAssertion;
  entityEditorGeneralInfoPreviewCardAssertion: EntityEditorPreviewCardAssertion;
  toolsetEditorSettingsPreviewCardAssertion: EntityEditorPreviewCardAssertion;
  toolsetEditorSettingsPreviewToggleAssertion: EntityEditorPreviewToggleAssertion;
  toolsetEditorViewFormAssertion: ToolsetEditorViewFormAssertion;
  externalAppEditorSettingsPreviewCardAssertion: EntityEditorPreviewCardAssertion;
  replaceConfirmationModalAssertion: ReplaceConfirmationModalAssertion;
  replaceConfirmationModalFolders: ReplaceConfirmationModalFolders;
  replaceConfirmationModalConversations: ReplaceConfirmationModalConversations;
  replaceConfirmationModalFoldersAssertion: FolderAssertion<ReplaceConfirmationModalFolders>;
  replaceConfirmationModalConversationsAssertion: EntityTreeAssertion<ReplaceConfirmationModalConversations>;
  toolsetAuthAssertion: ToolsetAuthAssertion;
  filesManagerContainer: FilesManagerContainer;
  filesManager: FilesManager;
  filesManagerToolbar: FilesManagerToolbar;
  filesManagerGrid: FilesManagerGrid;
  filesManagerCollapsibleSidebar: FilesManagerCollapsibleSidebar;
  filesManagerFoldersTree: FoldersTree;
  filesManagerGridRowDropdownMenu: Dropdown;
  filesManagerDeleteItemConfirmationPopup: ConfirmationPopup;
  filesManagerModal: FilesManagerModal;
  filesManagerModalManager: FilesManager;
  filesManagerModalGrid: FilesManagerGrid;
  filesManagerModalToolbar: FilesManagerToolbar;
  filesManagerModalCollapsibleSidebar: FilesManagerCollapsibleSidebar;
  filesManagerModalFoldersTree: FoldersTree;
  filesManagerDeleteItemConfirmationPopupAssertion: ConfirmationPopupAssertion;
  filesManagerGridAssertion: FilesManagerGridAssertion;
  filesManagerModalGridAssertion: FilesManagerGridAssertion;
  fileConflictConfirmationPopup: ConfirmationPopup;
  fileConflictConfirmationPopupAssertion: ConfirmationPopupAssertion;
}>({
  beforeTestCleanup: [
    async ({ dataInjector, fileApiHelper, toolsetApiHelper }, use) => {
      await dataInjector.deleteAllData();
      await fileApiHelper.deleteAllFiles();
      await toolsetApiHelper.deleteAllToolsets();
      await use('beforeTestCleanup');
    },
    { scope: 'test', auto: true },
  ],
  entityDetailsModalAssertion: async ({ entityDetailsModal }, use) => {
    const entityDetailsModalAssertion = new EntityDetailsModalAssertion(
      entityDetailsModal,
    );
    await use(entityDetailsModalAssertion);
  },
  entityEditorHeaderAssertion: async ({ entityEditorHeader }, use) => {
    const entityEditorHeaderAssertion = new EntityEditorHeaderAssertion(
      entityEditorHeader,
    );
    await use(entityEditorHeaderAssertion);
  },
  sendMessageInputAttachmentsAssertions: async (
    { sendMessageInputAttachments },
    use,
  ) => {
    const sendMessageInputAttachmentsAssertions =
      new InputAttachmentsAssertions(sendMessageInputAttachments);
    await use(sendMessageInputAttachmentsAssertions);
  },
  editMessageInputAttachmentsAssertions: async (
    { editMessageInputAttachments },
    use,
  ) => {
    const editMessageInputAttachmentsAssertions =
      new InputAttachmentsAssertions(editMessageInputAttachments);
    await use(editMessageInputAttachmentsAssertions);
  },
  localStorageAssertion: async ({ localStorageManager }, use) => {
    const localStorageAssertion = new LocalStorageAssertion(
      localStorageManager,
    );
    await use(localStorageAssertion);
  },
  sharedWithMeConversationAssertion: async (
    { sharedWithMeConversations },
    use,
  ) => {
    const sharedWithMeConversationAssertion =
      new SideBarConversationAssertion<SharedWithMeConversationsTree>(
        sharedWithMeConversations,
      );
    await use(sharedWithMeConversationAssertion);
  },
  sharedWithMeFolderDropdownMenu: async (
    { sharedFolderConversations },
    use,
  ) => {
    const sharedWithMeFolderDropdownMenu =
      sharedFolderConversations.getDropdownMenu();
    await use(sharedWithMeFolderDropdownMenu);
  },
  sharedFolderConversations: async ({ chatBar }, use) => {
    const sharedFolderConversations = chatBar.getSharedFolderConversations();
    await use(sharedFolderConversations);
  },
  sharedWithMeConversations: async ({ chatBar }, use) => {
    const sharedWithMeConversations =
      chatBar.getSharedWithMeConversationsTree();
    await use(sharedWithMeConversations);
  },
  sharedWithMeConversationDropdownMenu: async (
    { sharedWithMeConversations },
    use,
  ) => {
    const sharedWithMeConversationDropdownMenu =
      sharedWithMeConversations.getDropdownMenu();
    await use(sharedWithMeConversationDropdownMenu);
  },
  // eslint-disable-next-line no-empty-pattern
  storageState: async ({}, use) => {
    await use(stateFilePath(+process.env.TEST_PARALLEL_INDEX!));
  },
  dialHomePage: async ({ page }, use) => {
    const dialHomePage = new DialHomePage(page);
    await use(dialHomePage);
  },
  dialErrorPage: async ({ page }, use) => {
    const dialErrorPage = new DialErrorPage(page);
    await use(dialErrorPage);
  },
  marketplacePage: async ({ page }, use) => {
    const marketplacePage = new MarketplacePage(page);
    await use(marketplacePage);
  },
  filesManagerPage: async ({ page }, use) => {
    const filesManagerPage = new FilesManagerPage(page);
    await use(filesManagerPage);
  },
  entityEditorPage: async ({ page }, use) => {
    const entityEditorPage = new EntityEditorPage(page);
    await use(entityEditorPage);
  },
  appContainer: async ({ dialHomePage }, use) => {
    const appContainer = dialHomePage.getAppContainer();
    await use(appContainer);
  },
  marketplaceContainer: async ({ marketplacePage }, use) => {
    const marketplaceContainer = marketplacePage.getMarketplaceContainer();
    await use(marketplaceContainer);
  },
  customAppEditorContainer: async ({ entityEditorPage }, use) => {
    const customAppEditorContainer =
      entityEditorPage.getCustomAppEditorContainer();
    await use(customAppEditorContainer);
  },
  entityEditorGeneralForm: async ({ entityEditorPage }, use) => {
    const entityEditorGeneralForm =
      entityEditorPage.getEntityEditorGeneralForm();
    await use(entityEditorGeneralForm);
  },
  entityEditorHeader: async ({ entityEditorPage }, use) => {
    const entityEditorHeader = entityEditorPage.getEntityEditorHeader();
    await use(entityEditorHeader);
  },
  entityEditorGeneralInfoPreview: async ({ entityEditorPage }, use) => {
    const entityEditorGeneralInfoPreview =
      entityEditorPage.getEntityEditorGeneralInfoPreview();
    await use(entityEditorGeneralInfoPreview);
  },
  entityEditorGeneralInfoPreviewCard: async (
    { entityEditorGeneralInfoPreview },
    use,
  ) => {
    const entityEditorGeneralInfoPreviewCard =
      entityEditorGeneralInfoPreview.getEntityEditorPreviewCard();
    await use(entityEditorGeneralInfoPreviewCard);
  },
  customAppEditorViewForm: async ({ customAppEditorContainer }, use) => {
    const customAppEditorViewForm =
      customAppEditorContainer.getEntityEditorViewForm();
    await use(customAppEditorViewForm);
  },
  customAppEditorAppSettingsPreview: async (
    { customAppEditorContainer },
    use,
  ) => {
    const customAppEditorAppSettingsPreview =
      customAppEditorContainer.getEntityEditorEntitySettingsPreview();
    await use(customAppEditorAppSettingsPreview);
  },
  customAppEditorAppSettingsPreviewBody: async (
    { customAppEditorAppSettingsPreview },
    use,
  ) => {
    const customAppEditorAppSettingsPreviewBody =
      customAppEditorAppSettingsPreview.getEntityEditorEntitySettingsPreviewBody();
    await use(customAppEditorAppSettingsPreviewBody);
  },
  customAppEditorAppSettingsPreviewChat: async (
    { customAppEditorAppSettingsPreviewBody },
    use,
  ) => {
    const customAppEditorAppSettingsPreviewChat =
      customAppEditorAppSettingsPreviewBody.getAppEditorAppSettingsPreviewChat();
    await use(customAppEditorAppSettingsPreviewChat);
  },
  externalAppEditorContainer: async ({ entityEditorPage }, use) => {
    const externalAppEditorContainer =
      entityEditorPage.getExternalAppEditorContainer();
    await use(externalAppEditorContainer);
  },
  externalAppEditorViewForm: async ({ externalAppEditorContainer }, use) => {
    const externalAppEditorViewForm =
      externalAppEditorContainer.getEntityEditorViewForm();
    await use(externalAppEditorViewForm);
  },
  externalAppEditorAppSettingsPreview: async (
    { externalAppEditorContainer },
    use,
  ) => {
    const externalAppEditorAppSettingsPreview =
      externalAppEditorContainer.getEntityEditorEntitySettingsPreview();
    await use(externalAppEditorAppSettingsPreview);
  },
  externalAppEditorAppSettingsPreviewBody: async (
    { externalAppEditorAppSettingsPreview },
    use,
  ) => {
    const externalAppEditorAppSettingsPreviewBody =
      externalAppEditorAppSettingsPreview.getEntityEditorEntitySettingsPreviewBody();
    await use(externalAppEditorAppSettingsPreviewBody);
  },
  externalAppEditorAppSettingsPreviewCard: async (
    { externalAppEditorAppSettingsPreviewBody },
    use,
  ) => {
    const externalAppEditorAppSettingsPreviewCard =
      externalAppEditorAppSettingsPreviewBody.getEntityEditorPreviewCard();
    await use(externalAppEditorAppSettingsPreviewCard);
  },
  toolsetEditorContainer: async ({ entityEditorPage }, use) => {
    const toolsetEditorContainer = entityEditorPage.getToolsetEditorContainer();
    await use(toolsetEditorContainer);
  },
  toolsetEditorViewForm: async ({ toolsetEditorContainer }, use) => {
    const toolsetEditorViewForm =
      toolsetEditorContainer.getEntityEditorViewForm();
    await use(toolsetEditorViewForm);
  },
  toolsetEditorSettingsPreview: async ({ toolsetEditorContainer }, use) => {
    const toolsetEditorSettingsPreview =
      toolsetEditorContainer.getEntityEditorEntitySettingsPreview();
    await use(toolsetEditorSettingsPreview);
  },
  toolsetEditorSettingsPreviewBody: async (
    { toolsetEditorSettingsPreview },
    use,
  ) => {
    const toolsetEditorSettingsPreviewBody =
      toolsetEditorSettingsPreview.getEntityEditorEntitySettingsPreviewBody();
    await use(toolsetEditorSettingsPreviewBody);
  },
  toolsetEditorSettingsPreviewCard: async (
    { toolsetEditorSettingsPreviewBody },
    use,
  ) => {
    const toolsetEditorSettingsPreviewCard =
      toolsetEditorSettingsPreviewBody.getEntityEditorPreviewCard();
    await use(toolsetEditorSettingsPreviewCard);
  },
  marketplaceSidebar: async ({ marketplaceContainer }, use) => {
    const marketplaceSidebar = marketplaceContainer.getMarketplaceSidebar();
    await use(marketplaceSidebar);
  },
  marketplaceFilter: async ({ marketplaceSidebar }, use) => {
    const marketplaceFilter = marketplaceSidebar.getMarketplaceFilter();
    await use(marketplaceFilter);
  },
  marketplace: async ({ marketplaceContainer }, use) => {
    const marketplace = marketplaceContainer.getMarketplace();
    await use(marketplace);
  },
  marketplaceEntitiesSection: async ({ marketplace }, use) => {
    const marketplaceEntitiesSection =
      marketplace.getMarketplaceEntitiesSection();
    await use(marketplaceEntitiesSection);
  },
  marketplaceEntities: async ({ marketplaceEntitiesSection }, use) => {
    const marketplaceEntities = marketplaceEntitiesSection.getEntities();
    await use(marketplaceEntities);
  },
  entityDetailsModal: async ({ marketplaceEntities }, use) => {
    const entityDetailsModal = marketplaceEntities.getEntityDetailsModal();
    await use(entityDetailsModal);
  },
  marketplaceHeader: async ({ marketplace }, use) => {
    const marketplaceHeader = marketplace.getMarketplaceHeader();
    await use(marketplaceHeader);
  },
  addAppDropdownMenu: async ({ page }, use) => {
    const addAppDropdownMenu = new DropdownMenu(page);
    await use(addAppDropdownMenu);
  },
  chatBar: async ({ appContainer }, use) => {
    const chatBar = appContainer.getChatBar();
    await use(chatBar);
  },
  navigationPanel: async ({ appContainer }, use) => {
    const navigationPanel = appContainer.getNavigationPanel();
    await use(navigationPanel);
  },
  importExportLoader: async ({ appContainer }, use) => {
    const importExportLoader = appContainer.getImportExportLoader();
    await use(importExportLoader);
  },
  header: async ({ appContainer }, use) => {
    const header = appContainer.getHeader();
    await use(header);
  },
  accountSettings: async ({ header }, use) => {
    const accountSettings = header.getAccountSettings();
    await use(accountSettings);
  },
  accountDropdownMenu: async ({ accountSettings }, use) => {
    const accountDropdownMenu = accountSettings.getDropdownMenu();
    await use(accountDropdownMenu);
  },
  banner: async ({ appContainer }, use) => {
    const banner = appContainer.getBanner();
    await use(banner);
  },
  promptBar: async ({ appContainer }, use) => {
    const promptBar = appContainer.getPromptBar();
    await use(promptBar);
  },
  promptBarSearch: async ({ promptBar }, use) => {
    const promptBarSearch = promptBar.getSearch();
    await use(promptBarSearch);
  },
  fileDropArea: async ({ appContainer }, use) => {
    const fileDropArea = appContainer.getFileDropArea();
    await use(fileDropArea);
  },
  dragFile: async ({ fileDropArea }, use) => {
    const dragFile = fileDropArea.getDragFile();
    await use(dragFile);
  },
  chat: async ({ fileDropArea }, use) => {
    const chat = fileDropArea.getChat();
    await use(chat);
  },
  footer: async ({ appContainer }, use) => {
    const footer = appContainer.getFooter();
    await use(footer);
  },
  chatMessages: async ({ chat }, use) => {
    const chatMessages = chat.getChatMessages();
    await use(chatMessages);
  },
  editMessageInputAttachments: async ({ chatMessages }, use) => {
    const editMessageInputAttachments = chatMessages.getInputAttachments();
    await use(editMessageInputAttachments);
  },
  sendMessage: async ({ chat }, use) => {
    const sendMessage = chat.getSendMessage();
    await use(sendMessage);
  },
  attachmentDropdownMenu: async ({ sendMessage }, use) => {
    const attachmentDropdownMenu = sendMessage.getDropdownMenu();
    await use(attachmentDropdownMenu);
  },
  sendMessageInputAttachments: async ({ sendMessage }, use) => {
    const sendMessageInputAttachments = sendMessage.getInputAttachments();
    await use(sendMessageInputAttachments);
  },
  conversations: async ({ chatBar }, use) => {
    const conversations = chatBar.getConversationsTree();
    await use(conversations);
  },
  prompts: async ({ promptBar }, use) => {
    const prompts = promptBar.getPromptsTree();
    await use(prompts);
  },
  folderConversations: async ({ chatBar }, use) => {
    const folderConversations = chatBar.getFolderConversations();
    await use(folderConversations);
  },
  chatBarSearch: async ({ chatBar }, use) => {
    const chatBarSearch = chatBar.getSearch();
    await use(chatBarSearch);
  },
  chatFilter: async ({ chatBarSearch }, use) => {
    const chatFilter = chatBarSearch.getFilter();
    await use(chatFilter);
  },
  promptFilter: async ({ promptBarSearch }, use) => {
    const promptFilter = promptBarSearch.getFilter();
    await use(promptFilter);
  },
  chatFilterDropdownMenu: async ({ chatFilter }, use) => {
    const chatFilterDropdownMenu = chatFilter.getFilterDropdownMenu();
    await use(chatFilterDropdownMenu);
  },
  promptFilterDropdownMenu: async ({ promptFilter }, use) => {
    const promptFilterDropdownMenu = promptFilter.getFilterDropdownMenu();
    await use(promptFilterDropdownMenu);
  },
  folderPrompts: async ({ promptBar }, use) => {
    const folderPrompts = promptBar.getPinnedFolderPrompts();
    await use(folderPrompts);
  },
  organizationFolderPrompts: async ({ promptBar }, use) => {
    const organizationFolderPrompts = promptBar.getOrganizationFolderPrompts();
    await use(organizationFolderPrompts);
  },
  organizationConversations: async ({ chatBar }, use) => {
    const organizationConversations =
      chatBar.getOrganizationConversationsTree();
    await use(organizationConversations);
  },
  organizationPrompts: async ({ promptBar }, use) => {
    const organizationPrompts = promptBar.getOrganizationPromptsTree();
    await use(organizationPrompts);
  },
  conversationSettingsModal: async ({ page }, use) => {
    const conversationSettingsModal = new ConversationSettingsModal(page);
    await use(conversationSettingsModal);
  },
  organizationFolderConversations: async ({ chatBar }, use) => {
    const organizationFolderConversations =
      chatBar.getOrganizationFolderConversations();
    await use(organizationFolderConversations);
  },
  talkToAgentDialog: async ({ page }, use) => {
    const talkToAgentDialog = new TalkToAgentDialog(page);
    await use(talkToAgentDialog);
  },
  talkToAgents: async ({ talkToAgentDialog }, use) => {
    const talkToAgents = talkToAgentDialog.getAgents();
    await use(talkToAgents);
  },
  agentSettings: async ({ conversationSettingsModal }, use) => {
    const agentSettings = conversationSettingsModal.getAgentSettings();
    await use(agentSettings);
  },
  temperatureSlider: async ({ agentSettings }, use) => {
    const temperatureSlider = agentSettings.getTemperatureSlider();
    await use(temperatureSlider);
  },
  agentInfo: async ({ chat }, use) => {
    const agentInfo = chat.getAgentInfo();
    await use(agentInfo);
  },
  conversationDropdownMenu: async ({ conversations }, use) => {
    const conversationDropdownMenu = conversations.getDropdownMenu();
    await use(conversationDropdownMenu);
  },
  folderDropdownMenu: async ({ folderConversations }, use) => {
    const folderDropdownMenu = folderConversations.getDropdownMenu();
    await use(folderDropdownMenu);
  },
  promptDropdownMenu: async ({ prompts }, use) => {
    const promptDropdownMenu = prompts.getDropdownMenu();
    await use(promptDropdownMenu);
  },
  confirmationDialog: async ({ page }, use) => {
    const confirmationDialog = new ConfirmationDialog(page);
    await use(confirmationDialog);
  },
  replaceConfirmationModal: async ({ page }, use) => {
    const replaceConfirmationModal = new ReplaceConfirmationModal(page);
    await use(replaceConfirmationModal);
  },
  promptModalDialog: async ({ page }, use) => {
    const promptModalDialog = new PromptModalDialog(page);
    await use(promptModalDialog);
  },
  renameConversationModal: async ({ page }, use) => {
    const renameConversationModal = new RenameConversationModal(page);
    await use(renameConversationModal);
  },
  renameConversationModalAssertion: async (
    { renameConversationModal },
    use,
  ) => {
    const renameConversationModalAssertion =
      new RenameConversationModalAssertion(renameConversationModal);
    await use(renameConversationModalAssertion);
  },
  variableModalDialog: async ({ page }, use) => {
    const variableModalDialog = new VariableModalDialog(page);
    await use(variableModalDialog);
  },
  chatHeader: async ({ chat }, use) => {
    const chatHeader = chat.getChatHeader();
    await use(chatHeader);
  },
  chatHeaderVersionDropdownMenu: async ({ page }, use) => {
    const chatHeaderVersionDropdownMenu = new DropdownMenu(page);
    await use(chatHeaderVersionDropdownMenu);
  },
  chatHeaderDropdownMenu: async ({ page }, use) => {
    const chatHeaderDropdownMenu = new DropdownMenu(page);
    await use(chatHeaderDropdownMenu);
  },
  modelInfoTooltip: async ({ page }, use) => {
    const modelInfoTooltip = new ModelInfoTooltip(page);
    await use(modelInfoTooltip);
  },
  chatSettingsTooltip: async ({ page }, use) => {
    const chatSettingsTooltip = new ChatSettingsTooltip(page);
    await use(chatSettingsTooltip);
  },
  compare: async ({ chat }, use) => {
    const compare = chat.getCompare();
    await use(compare);
  },
  compareConversation: async ({ compare }, use) => {
    const compareConversation = compare.getConversationToCompare();
    await use(compareConversation);
  },
  rightChatHeader: async ({ compare }, use) => {
    const rightChatHeader = compare.getRightChatHeader();
    await use(rightChatHeader);
  },
  leftChatHeader: async ({ compare }, use) => {
    const leftChatHeader = compare.getLeftChatHeader();
    await use(leftChatHeader);
  },
  tooltip: async ({ page }, use) => {
    const tooltip = new Tooltip(page);
    await use(tooltip);
  },
  topicsTooltip: async ({ page }, use) => {
    const topicsTooltip = new TopicsTooltip(page);
    await use(topicsTooltip);
  },
  errorPopup: async ({ page }, use) => {
    const errorPopup = new ErrorPopup(page);
    await use(errorPopup);
  },
  playbackControl: async ({ chat }, use) => {
    const playbackControl = chat.getPlaybackControl();
    await use(playbackControl);
  },
  shareModal: async ({ page }, use) => {
    const shareModal = new ShareModal(page);
    await use(shareModal);
  },
  shareAppModal: async ({ page }, use) => {
    const shareAppModal = new ShareAppModal(page);
    await use(shareAppModal);
  },
  modelApiHelper: async ({ request }, use) => {
    const modelApiHelper = new ModelApiHelper(request);
    await use(modelApiHelper);
  },
  iconApiHelper: async ({ request }, use) => {
    const iconApiHelper = new IconApiHelper(request);
    await use(iconApiHelper);
  },
  chatApiHelper: async ({ request }, use) => {
    const chatApiHelper = new ChatApiHelper(request);
    await use(chatApiHelper);
  },
  fileApiHelper: async ({ request }, use) => {
    const fileApiHelper = new FileApiHelper(request);
    await use(fileApiHelper);
  },
  adminFileApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminFileApiHelper = new FileApiHelper(
      adminUserRequestContext,
      BucketUtil.getAdminUserBucket(),
    );
    await use(adminFileApiHelper);
  },
  additionalSecondShareUserFileApiHelper: async (
    { additionalSecondShareUserRequestContext },
    use,
  ) => {
    const additionalSecondShareUserFileApiHelper = new FileApiHelper(
      additionalSecondShareUserRequestContext,
      BucketUtil.getAdditionalSecondShareUserBucket(),
    );
    await use(additionalSecondShareUserFileApiHelper);
  },
  itemApiHelper: async ({ request }, use) => {
    const conversationApiHelper = new ItemApiHelper(request);
    await use(conversationApiHelper);
  },
  applicationApiHelper: async ({ request }, use) => {
    const applicationApiHelper = new ApplicationApiHelper(request);
    await use(applicationApiHelper);
  },
  toolsetApiHelper: async ({ request }, use) => {
    const toolsetApiHelper = new ToolsetApiHelper(request);
    await use(toolsetApiHelper);
  },
  apiInjector: async ({ itemApiHelper }, use) => {
    const apiInjector = new ApiInjector(itemApiHelper);
    await use(apiInjector);
  },
  browserStorageInjector: async ({ localStorageManager }, use) => {
    const browserStorageInjector = new BrowserStorageInjector(
      localStorageManager,
    );
    await use(browserStorageInjector);
  },
  dataInjector: async ({ apiInjector, browserStorageInjector }, use) => {
    const dataInjector = isApiStorageType
      ? apiInjector
      : browserStorageInjector;
    await use(dataInjector);
  },
  toast: async ({ appContainer }, use) => {
    const errorToast = appContainer.getToast();
    await use(errorToast);
  },
  mainUserShareApiHelper: async ({ request }, use) => {
    const mainUserShareApiHelper = new ShareApiHelper(request);
    await use(mainUserShareApiHelper);
  },
  adminUserItemApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminUserItemApiHelper = new ItemApiHelper(
      adminUserRequestContext,
      BucketUtil.getAdminUserBucket(),
    );
    await use(adminUserItemApiHelper);
  },
  adminApplicationApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminApplicationApiHelper = new ApplicationApiHelper(
      adminUserRequestContext,
      BucketUtil.getAdminUserBucket(),
    );
    await use(adminApplicationApiHelper);
  },
  adminShareApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminShareApiHelper = new ShareApiHelper(
      adminUserRequestContext,
      BucketUtil.getAdminUserBucket(),
    );
    await use(adminShareApiHelper);
  },
  additionalShareUserRequestContext: async ({ playwright }, use) => {
    const additionalShareUserRequestContext =
      await playwright.request.newContext({
        storageState: stateFilePath(
          dialTest.info().parallelIndex + +config.workers!,
        ),
      });
    await use(additionalShareUserRequestContext);
  },
  additionalSecondShareUserRequestContext: async ({ playwright }, use) => {
    const additionalSecondShareUserRequestContext =
      await playwright.request.newContext({
        storageState: stateFilePath(
          dialTest.info().parallelIndex + +config.workers! * 2,
        ),
      });
    await use(additionalSecondShareUserRequestContext);
  },
  adminUserRequestContext: async ({ playwright }, use) => {
    const adminUserRequestContext = await playwright.request.newContext({
      storageState: stateFilePath(+config.workers! * 3),
    });
    await use(adminUserRequestContext);
  },
  additionalUserShareApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserShareApiHelper = new ShareApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    );
    await use(additionalUserShareApiHelper);
  },
  additionalSecondUserShareApiHelper: async (
    { additionalSecondShareUserRequestContext },
    use,
  ) => {
    const additionalSecondUserShareApiHelper = new ShareApiHelper(
      additionalSecondShareUserRequestContext,
      BucketUtil.getAdditionalSecondShareUserBucket(),
    );
    await use(additionalSecondUserShareApiHelper);
  },
  additionalUserItemApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserItemApiHelper = new ItemApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    ); // Use User2's bucket
    await use(additionalUserItemApiHelper);
  },
  additionalUserFileApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserFileApiHelper = new FileApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    ); // Use User2's bucket
    await use(additionalUserFileApiHelper);
  },
  additionalUserApplicationApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserApplicationApiHelper = new ApplicationApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    ); // Use User2's bucket
    await use(additionalUserApplicationApiHelper);
  },
  additionalUserModelApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserModelApiHelper = new ModelApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    ); // Use User2's bucket
    await use(additionalUserModelApiHelper);
  },
  chatNotFound: async ({ page }, use) => {
    const chatNotFound = new ChatNotFound(page);
    await use(chatNotFound);
  },
  additionalSecondUserItemApiHelper: async (
    { additionalSecondShareUserRequestContext },
    use,
  ) => {
    const additionalSecondUserItemApiHelper = new ItemApiHelper(
      additionalSecondShareUserRequestContext,
      BucketUtil.getAdditionalSecondShareUserBucket(),
    );
    await use(additionalSecondUserItemApiHelper);
  },
  attachFilesModal: async ({ page }, use) => {
    const attachFilesModal = new AttachFilesModal(page);
    await use(attachFilesModal);
  },
  uploadFromDeviceModal: async ({ page }, use) => {
    const uploadFromDeviceModal = new UploadFromDeviceModal(page);
    await use(uploadFromDeviceModal);
  },
  selectFolderModal: async ({ page }, use) => {
    const selectFolderModal = new SelectFolderModal(page);
    await use(selectFolderModal);
  },
  selectFolders: async ({ selectFolderModal }, use) => {
    const selectUploadFolder = selectFolderModal.getSelectFolders();
    await use(selectUploadFolder);
  },
  attachedAllFiles: async ({ attachFilesModal }, use) => {
    const attachedAllFiles = attachFilesModal.getAllFolderFiles();
    await use(attachedAllFiles);
  },
  attachedOrganizationFiles: async ({ attachFilesModal }, use) => {
    const attachedOrganizationFiles =
      attachFilesModal.getOrganizationFolderFiles();
    await use(attachedOrganizationFiles);
  },
  messageTemplateModal: async ({ page }, use) => {
    const messageTemplateModal = new MessageTemplateModal(page);
    await use(messageTemplateModal);
  },
  settingsModal: async ({ page }, use) => {
    const settingsModal = new SettingsModal(page);
    await use(settingsModal);
  },
  publishingRequestDialog: async ({ page }, use) => {
    const publishingRequestDialog = new PublishingRequestDialog(page);
    await use(publishingRequestDialog);
  },
  conversationsToPublishTree: async ({ publishingRequestDialog }, use) => {
    const conversationsToPublishTree =
      publishingRequestDialog.getConversationsToPublishTree();
    await use(conversationsToPublishTree);
  },
  filesToPublishTree: async ({ publishingRequestDialog }, use) => {
    const filesToPublishTree = publishingRequestDialog.getFilesToPublishTree();
    await use(filesToPublishTree);
  },
  promptsToPublishTree: async ({ publishingRequestDialog }, use) => {
    const promptsToPublishTree =
      publishingRequestDialog.getPromptsToPublishTree();
    await use(promptsToPublishTree);
  },
  appsToPublishTree: async ({ publishingRequestDialog }, use) => {
    const appsToPublishTree =
      publishingRequestDialog.getApplicationsToPublishTree();
    await use(appsToPublishTree);
  },
  folderConversationsToPublish: async ({ publishingRequestDialog }, use) => {
    const folderConversationsToPublish =
      publishingRequestDialog.getFolderConversationsToPublish();
    await use(folderConversationsToPublish);
  },
  publicationApiHelper: async ({ request }, use) => {
    const publicationApiHelper = new PublicationApiHelper(request);
    await use(publicationApiHelper);
  },
  adminPublicationApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminPublicationApiHelper = new PublicationApiHelper(
      adminUserRequestContext,
      BucketUtil.getAdminUserBucket(),
    );
    await use(adminPublicationApiHelper);
  },
  additionalShareUserPublicationApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalShareUserPublicationApiHelper = new PublicationApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    );
    await use(additionalShareUserPublicationApiHelper);
  },
  additionalSecondShareUserPublicationApiHelper: async (
    { additionalSecondShareUserRequestContext },
    use,
  ) => {
    const additionalSecondShareUserPublicationApiHelper =
      new PublicationApiHelper(
        additionalSecondShareUserRequestContext,
        BucketUtil.getAdditionalSecondShareUserBucket(),
      );
    await use(additionalSecondShareUserPublicationApiHelper);
  },
  publishingRules: async ({ publishingRequestDialog }, use) => {
    const publishingRules = publishingRequestDialog.getPublishingRules();
    await use(publishingRules);
  },
  publishingFilter: async ({ publishingRules }, use) => {
    const publishingFilter = publishingRules.gePublishingFilter();
    await use(publishingFilter);
  },
  informationModal: async ({ page }, use) => {
    const informationModal = new InformationModal(page);
    await use(informationModal);
  },
  listboxMenu: async ({ page }, use) => {
    const listboxMenu = new ListboxMenu(page);
    await use(listboxMenu);
  },
  informationModalAssertion: async ({ informationModal }, use) => {
    const informationModalAssertion = new InformationModalAssertion(
      informationModal,
    );
    await use(informationModalAssertion);
  },
  conversationAssertion: async ({ conversations }, use) => {
    const conversationAssertion = new ConversationAssertion(conversations);
    await use(conversationAssertion);
  },
  manageAttachmentsAssertion: async ({ attachFilesModal }, use) => {
    const manageAttachmentsAssertion = new ManageAttachmentsAssertion(
      attachFilesModal,
    );
    await use(manageAttachmentsAssertion);
  },
  organizationConversationAssertion: async (
    { organizationConversations },
    use,
  ) => {
    const organizationConversationAssertion =
      new SideBarConversationAssertion<OrganizationConversationsTree>(
        organizationConversations,
      );
    await use(organizationConversationAssertion);
  },
  organizationPromptAssertion: async ({ organizationPrompts }, use) => {
    const organizationPromptAssertion =
      new SideBarEntityAssertion<OrganizationPromptsTree>(organizationPrompts);
    await use(organizationPromptAssertion);
  },
  chatBarFolderAssertion: async ({ folderConversations }, use) => {
    const chatBarFolderAssertion = new FolderAssertion<FolderConversations>(
      folderConversations,
    );
    await use(chatBarFolderAssertion);
  },
  allFilesFolderAssertion: async ({ attachFilesModal }, use) => {
    const allFilesFolderAssertion = new ManageAttachmentFoldersAssertion(
      attachFilesModal,
      FileModalSection.AllFiles,
    );
    await use(allFilesFolderAssertion);
  },
  organizationFoldersAssertion: async ({ attachFilesModal }, use) => {
    const organizationFoldersAssertion = new ManageAttachmentFoldersAssertion(
      attachFilesModal,
      FileModalSection.Organization,
    );
    await use(organizationFoldersAssertion);
  },
  toastAssertion: async ({ toast }, use) => {
    const toastAssertion = new ToastAssertion(toast);
    await use(toastAssertion);
  },
  // eslint-disable-next-line no-empty-pattern
  downloadAssertion: async ({}, use) => {
    const downloadAssertion = new DownloadAssertion();
    await use(downloadAssertion);
  },
  promptModalAssertion: async ({ promptModalDialog }, use) => {
    const promptModalAssertion = new PromptModalAssertion(promptModalDialog);
    await use(promptModalAssertion);
  },
  tooltipAssertion: async ({ tooltip }, use) => {
    const tooltipAssertion = new TooltipAssertion(tooltip);
    await use(tooltipAssertion);
  },
  confirmationDialogAssertion: async ({ confirmationDialog }, use) => {
    const confirmationDialogAssertion = new ConfirmationDialogAssertion(
      confirmationDialog,
    );
    await use(confirmationDialogAssertion);
  },
  chatBarAssertion: async ({ chatBar }, use) => {
    const chatBarAssertion = new SideBarAssertion(chatBar);
    await use(chatBarAssertion);
  },
  promptBarFolderAssertion: async ({ folderPrompts }, use) => {
    const promptBarFolderAssertion = new FolderAssertion<FolderPrompts>(
      folderPrompts,
    );
    await use(promptBarFolderAssertion);
  },
  promptBarOrganizationFolderAssertion: async (
    { organizationFolderPrompts },
    use,
  ) => {
    const promptBarOrganizationFolderAssertion =
      new FolderAssertion<FolderPrompts>(organizationFolderPrompts);
    await use(promptBarOrganizationFolderAssertion);
  },
  promptAssertion: async ({ prompts }, use) => {
    const promptAssertion = new PromptAssertion(prompts);
    await use(promptAssertion);
  },
  promptBarAssertion: async ({ promptBar }, use) => {
    const promptBarAssertion = new SideBarAssertion(promptBar);
    await use(promptBarAssertion);
  },
  accountSettingsAssertion: async ({ accountSettings }, use) => {
    const accountSettingsAssertion = new AccountSettingsAssertion(
      accountSettings,
    );
    await use(accountSettingsAssertion);
  },
  accountDropdownMenuAssertion: async ({ accountDropdownMenu }, use) => {
    const accountDropdownMenuAssertion = new MenuAssertion(accountDropdownMenu);
    await use(accountDropdownMenuAssertion);
  },
  conversationDropdownMenuAssertion: async (
    { conversationDropdownMenu },
    use,
  ) => {
    const conversationDropdownMenuAssertion = new MenuAssertion(
      conversationDropdownMenu,
    );
    await use(conversationDropdownMenuAssertion);
  },
  promptDropdownMenuAssertion: async ({ promptDropdownMenu }, use) => {
    const promptDropdownMenuAssertion = new MenuAssertion(promptDropdownMenu);
    await use(promptDropdownMenuAssertion);
  },
  folderDropdownMenuAssertion: async ({ folderDropdownMenu }, use) => {
    const folderDropdownMenuAssertion = new MenuAssertion(folderDropdownMenu);
    await use(folderDropdownMenuAssertion);
  },
  settingsModalAssertion: async ({ settingsModal }, use) => {
    const settingsModalAssertion = new SettingsModalAssertion(settingsModal);
    await use(settingsModalAssertion);
  },
  sendMessageAssertion: async ({ sendMessage }, use) => {
    const sendMessageAssertion = new SendMessageAssertion(sendMessage);
    await use(sendMessageAssertion);
  },
  chatHeaderAssertion: async ({ chatHeader }, use) => {
    const chatHeaderAssertion = new ChatHeaderAssertion(chatHeader);
    await use(chatHeaderAssertion);
  },
  rightChatHeaderAssertion: async ({ rightChatHeader }, use) => {
    const rightChatHeaderAssertion = new ChatHeaderAssertion(rightChatHeader);
    await use(rightChatHeaderAssertion);
  },
  leftChatHeaderAssertion: async ({ leftChatHeader }, use) => {
    const leftChatHeaderAssertion = new ChatHeaderAssertion(leftChatHeader);
    await use(leftChatHeaderAssertion);
  },
  chatMessagesAssertion: async ({ chatMessages }, use) => {
    const chatMessagesAssertion = new ChatMessagesAssertion(chatMessages);
    await use(chatMessagesAssertion);
  },
  footerAssertion: async ({ footer }, use) => {
    const footerAssertion = new FooterAssertion(footer);
    await use(footerAssertion);
  },
  sendMessagePromptListAssertion: async ({ sendMessage }, use) => {
    const sendMessagePromptListAssertion = new PromptListAssertion(
      sendMessage.getPromptList(),
    );
    await use(sendMessagePromptListAssertion);
  },
  systemPromptListAssertion: async ({ agentSettings }, use) => {
    const systemPromptListAssertion = new PromptListAssertion(
      agentSettings.getPromptList(),
    );
    await use(systemPromptListAssertion);
  },
  variableModalAssertion: async ({ variableModalDialog }, use) => {
    const variableModalAssertion = new VariableModalAssertion(
      variableModalDialog,
    );
    await use(variableModalAssertion);
  },
  chatAssertion: async ({ chat }, use) => {
    const chatAssertion = new ChatAssertion(chat);
    await use(chatAssertion);
  },
  agentSettingAssertion: async ({ agentSettings }, use) => {
    const agentSettingAssertion = new AgentSettingAssertion(agentSettings);
    await use(agentSettingAssertion);
  },
  playbackAssertion: async ({ playbackControl }, use) => {
    const playbackAssertion = new PlaybackAssertion(playbackControl);
    await use(playbackAssertion);
  },
  shareModalAssertion: async ({ shareModal }, use) => {
    const shareModalAssertion = new ShareModalAssertion(shareModal);
    await use(shareModalAssertion);
  },
  shareAppModalAssertion: async ({ shareAppModal }, use) => {
    const shareAppModalAssertion = new ShareAppModalAssertion(shareAppModal);
    await use(shareAppModalAssertion);
  },
  publishingRequestDialogAssertion: async (
    { publishingRequestDialog },
    use,
  ) => {
    const publishingRequestDialogAssertion =
      new PublishingRequestDialogAssertion(publishingRequestDialog);
    await use(publishingRequestDialogAssertion);
  },
  selectFoldersAssertion: async ({ selectFolders }, use) => {
    const selectFoldersAssertion = new FolderAssertion(selectFolders);
    await use(selectFoldersAssertion);
  },
  selectFolderModalAssertion: async ({ selectFolderModal }, use) => {
    const selectFolderModalAssertion = new SelectFolderModalAssertion(
      selectFolderModal,
    );
    await use(selectFolderModalAssertion);
  },
  conversationInfoTooltipAssertion: async ({ modelInfoTooltip }, use) => {
    const conversationInfoTooltipAssertion =
      new ConversationInfoTooltipAssertion(modelInfoTooltip);
    await use(conversationInfoTooltipAssertion);
  },
  agentInfoAssertion: async ({ agentInfo }, use) => {
    const agentInfoAssertion = new AgentInfoAssertion(agentInfo);
    await use(agentInfoAssertion);
  },
  conversationToCompareAssertion: async ({ compareConversation }, use) => {
    const conversationToCompareAssertion = new ConversationToCompareAssertion(
      compareConversation,
    );
    await use(conversationToCompareAssertion);
  },
  publishingRequestFolderConversationAssertion: async (
    { publishingRequestDialog },
    use,
  ) => {
    const publishingRequestFolderConversationAssertion = new FolderAssertion(
      publishingRequestDialog.getFolderConversationsToPublish(),
    );
    await use(publishingRequestFolderConversationAssertion);
  },
  publishingRequestFolderPromptAssertion: async (
    { publishingRequestDialog },
    use,
  ) => {
    const publishingRequestFolderPromptAssertion = new PublishFolderAssertion(
      publishingRequestDialog.getFolderPromptsToPublish(),
    );
    await use(publishingRequestFolderPromptAssertion);
  },
  talkToAgentDialogAssertion: async ({ talkToAgentDialog }, use) => {
    const talkToAgentDialogAssertion = new TalkToAgentDialogAssertion(
      talkToAgentDialog,
    );
    await use(talkToAgentDialogAssertion);
  },
  publishConversationAssertion: async ({ conversationsToPublishTree }, use) => {
    const publishConversationAssertion =
      new PublishEntityAssertion<PublishConversationsTree>(
        conversationsToPublishTree,
      );
    await use(publishConversationAssertion);
  },
  publishFileTreeAssertion: async ({ filesToPublishTree }, use) => {
    const publishFileTreeAssertion = new PublishFileAssertion(
      filesToPublishTree,
    );
    await use(publishFileTreeAssertion);
  },
  publishPromptsTreeAssertion: async ({ promptsToPublishTree }, use) => {
    const publishPromptsTreeAssertion =
      new PublishEntityAssertion<PublishPromptsTree>(promptsToPublishTree);
    await use(publishPromptsTreeAssertion);
  },
  appToPublishAssertion: async ({ appsToPublishTree }, use) => {
    const appToPublishAssertion =
      new PublishEntityAssertion<PublishApplicationsTree>(appsToPublishTree);
    await use(appToPublishAssertion);
  },
  folderToPublishAssertion: async ({ publishingRequestDialog }, use) => {
    const folderToPublishAssertion = new PublishFolderAssertion(
      publishingRequestDialog.getFolderConversationsToPublish(),
    );
    await use(folderToPublishAssertion);
  },
  organizationFolderConversationAssertions: async (
    { organizationFolderConversations },
    use,
  ) => {
    const organizationFolderConversationAssertions = new FolderAssertion(
      organizationFolderConversations,
    );
    await use(organizationFolderConversationAssertions);
  },
  // eslint-disable-next-line no-empty-pattern
  shareApiAssertion: async ({}, use) => {
    const shareApiAssertion = new ShareApiAssertion();
    await use(shareApiAssertion);
  },
  messageTemplateModalAssertion: async ({ messageTemplateModal }, use) => {
    const messageTemplateModalAssertion = new MessageTemplateModalAssertion(
      messageTemplateModal,
    );
    await use(messageTemplateModalAssertion);
  },
  entityVersionsDropdownMenuAssertion: async ({ entityDetailsModal }, use) => {
    const entityVersionsDropdownMenuAssertion = new MenuAssertion(
      entityDetailsModal.getVersionDropdownMenu(),
    );
    await use(entityVersionsDropdownMenuAssertion);
  },
  addAppDropdownMenuAssertion: async ({ addAppDropdownMenu }, use) => {
    const addAppDropdownMenuAssertion = new MenuAssertion(addAppDropdownMenu);
    await use(addAppDropdownMenuAssertion);
  },
  promptPreviewModal: async ({ page }, use) => {
    const promptPreviewModalWindow = new PromptPreviewModalWindow(page);
    await use(promptPreviewModalWindow);
  },
  promptPreviewVersionDropdownMenu: async ({ page }, use) => {
    const promptPreviewVersionDropdownMenu = new DropdownMenu(page);
    await use(promptPreviewVersionDropdownMenu);
  },
  promptPreviewModalAssertion: async ({ promptPreviewModal }, use) => {
    const promptPreviewModalAssertion = new PromptPreviewModalAssertion(
      promptPreviewModal,
    );
    await use(promptPreviewModalAssertion);
  },
  attachAllFilesTreeAssertion: async ({ attachFilesModal }, use) => {
    const attachAllFilesTreeAssertion =
      new EntityTreeAssertion<AttachFilesTree>(
        attachFilesModal.getAllFilesTree(),
      );
    await use(attachAllFilesTreeAssertion);
  },
  adminCustomApplicationPublishingUtil: async (
    {
      customApplicationBuilder,
      publishRequestBuilder,
      adminApplicationApiHelper,
      adminPublicationApiHelper,
      fileApiHelper,
    },
    use,
  ) => {
    const adminCustomApplicationPublishingUtil =
      new CustomApplicationPublishingUtil(
        customApplicationBuilder,
        adminApplicationApiHelper,
        fileApiHelper,
        publishRequestBuilder,
        adminPublicationApiHelper,
      );
    await use(adminCustomApplicationPublishingUtil);
  },
  customApplicationPublishingUtil: async (
    { customApplicationBuilder, applicationApiHelper, fileApiHelper },
    use,
  ) => {
    const customApplicationPublishingUtil = new CustomApplicationPublishingUtil(
      customApplicationBuilder,
      applicationApiHelper,
      fileApiHelper,
    );
    await use(customApplicationPublishingUtil);
  },
  organizationFolderPromptAssertions: async (
    { organizationFolderPrompts },
    use,
  ) => {
    const organizationFolderPromptAssertions = new FolderAssertion(
      organizationFolderPrompts,
    );
    await use(organizationFolderPromptAssertions);
  },
  publishingRulesAssertion: async ({ publishingRules }, use) => {
    const publishingRulesAssertion = new PublishingRulesAssertion(
      publishingRules,
    );
    await use(publishingRulesAssertion);
  },
  publicationApiAssertion: async ({ publicationApiHelper }, use) => {
    const publicationApiAssertion = new PublicationApiAssertion(
      publicationApiHelper,
    );
    await use(publicationApiAssertion);
  },
  additionalShareUserPublicationApiAssertion: async (
    { additionalShareUserPublicationApiHelper },
    use,
  ) => {
    const additionalShareUserPublicationApiAssertion =
      new PublicationApiAssertion(additionalShareUserPublicationApiHelper);
    await use(additionalShareUserPublicationApiAssertion);
  },
  additionalSecondShareUserPublicationApiAssertion: async (
    { additionalSecondShareUserPublicationApiHelper },
    use,
  ) => {
    const additionalSecondShareUserPublicationApiAssertion =
      new PublicationApiAssertion(
        additionalSecondShareUserPublicationApiHelper,
      );
    await use(additionalSecondShareUserPublicationApiAssertion);
  },
  entityEditorGeneralInfoPreviewToggleAssertion: async (
    { entityEditorGeneralInfoPreview },
    use,
  ) => {
    const entityEditorGeneralInfoPreviewToggleAssertion =
      new EntityEditorPreviewToggleAssertion(
        entityEditorGeneralInfoPreview.getEntityEditorPreviewToggle(),
      );
    await use(entityEditorGeneralInfoPreviewToggleAssertion);
  },
  entityEditorGeneralInfoPreviewCardAssertion: async (
    { entityEditorGeneralInfoPreviewCard },
    use,
  ) => {
    const entityEditorGeneralInfoPreviewCardAssertion =
      new EntityEditorPreviewCardAssertion(entityEditorGeneralInfoPreviewCard);
    await use(entityEditorGeneralInfoPreviewCardAssertion);
  },
  toolsetEditorSettingsPreviewCardAssertion: async (
    { toolsetEditorSettingsPreviewCard },
    use,
  ) => {
    const toolsetEditorSettingsPreviewCardAssertion =
      new EntityEditorPreviewCardAssertion(toolsetEditorSettingsPreviewCard);
    await use(toolsetEditorSettingsPreviewCardAssertion);
  },
  toolsetEditorSettingsPreviewToggleAssertion: async (
    { toolsetEditorSettingsPreviewBody },
    use,
  ) => {
    const toolsetEditorSettingsPreviewToggleAssertion =
      new EntityEditorPreviewToggleAssertion(
        toolsetEditorSettingsPreviewBody.getEntityEditorPreviewToggle(),
      );
    await use(toolsetEditorSettingsPreviewToggleAssertion);
  },
  externalAppEditorSettingsPreviewCardAssertion: async (
    { externalAppEditorAppSettingsPreviewCard },
    use,
  ) => {
    const toolsetEditorSettingsPreviewCardAssertion =
      new EntityEditorPreviewCardAssertion(
        externalAppEditorAppSettingsPreviewCard,
      );
    await use(toolsetEditorSettingsPreviewCardAssertion);
  },
  toolsetEditorViewFormAssertion: async ({ toolsetEditorViewForm }, use) => {
    const toolsetEditorViewFormAssertion = new ToolsetEditorViewFormAssertion(
      toolsetEditorViewForm,
    );
    await use(toolsetEditorViewFormAssertion);
  },
  replaceConfirmationModalAssertion: async (
    { replaceConfirmationModal },
    use,
  ) => {
    const replaceConfirmationModalAssertion =
      new ReplaceConfirmationModalAssertion(replaceConfirmationModal);
    await use(replaceConfirmationModalAssertion);
  },
  replaceConfirmationModalFolders: async (
    { replaceConfirmationModal },
    use,
  ) => {
    const replaceConfirmationModalFolders =
      replaceConfirmationModal.getFolders();
    await use(replaceConfirmationModalFolders);
  },
  replaceConfirmationModalConversations: async (
    { replaceConfirmationModal },
    use,
  ) => {
    const replaceConfirmationModalConversations =
      replaceConfirmationModal.getConversations();
    await use(replaceConfirmationModalConversations);
  },
  replaceConfirmationModalFoldersAssertion: async (
    { replaceConfirmationModalFolders },
    use,
  ) => {
    const replaceConfirmationModalFoldersAssertion =
      new FolderAssertion<ReplaceConfirmationModalFolders>(
        replaceConfirmationModalFolders,
      );
    await use(replaceConfirmationModalFoldersAssertion);
  },
  replaceConfirmationModalConversationsAssertion: async (
    { replaceConfirmationModalConversations },
    use,
  ) => {
    const replaceConfirmationModalConversationsAssertion =
      new EntityTreeAssertion<ReplaceConfirmationModalConversations>(
        replaceConfirmationModalConversations,
      );
    await use(replaceConfirmationModalConversationsAssertion);
  },
  toolsetAuthAssertion: async (
    { toolsetEditorViewForm, toolsetEditorSettingsPreviewCard },
    use,
  ) => {
    const toolsetOAuthAssertion = new ToolsetAuthAssertion(
      toolsetEditorSettingsPreviewCard,
      toolsetEditorViewForm,
    );
    await use(toolsetOAuthAssertion);
  },
  filesManagerContainer: async ({ filesManagerPage }, use) => {
    const filesManagerContainer = filesManagerPage.getFilesManagerContainer();
    await use(filesManagerContainer);
  },
  filesManager: async ({ filesManagerContainer }, use) => {
    const filesManager = filesManagerContainer.getFilesManager();
    await use(filesManager);
  },
  filesManagerToolbar: async ({ filesManager }, use) => {
    const filesManagerToolbar = filesManager.getFilesManagerToolbar();
    await use(filesManagerToolbar);
  },
  filesManagerGrid: async ({ filesManager }, use) => {
    const filesManagerGrid = filesManager.getFilesManagerGrid();
    await use(filesManagerGrid);
  },
  filesManagerGridRowDropdownMenu: async ({ filesManagerGrid }, use) => {
    const filesManagerGridRowDropdownMenu =
      filesManagerGrid.getRowDropdownMenu();
    await use(filesManagerGridRowDropdownMenu);
  },
  filesManagerCollapsibleSidebar: async ({ filesManager }, use) => {
    const filesManagerCollapsibleSidebar =
      filesManager.getFilesManagerCollapsibleSidebar();
    await use(filesManagerCollapsibleSidebar);
  },
  filesManagerFoldersTree: async ({ filesManagerCollapsibleSidebar }, use) => {
    const filesManagerFoldersTree =
      filesManagerCollapsibleSidebar.getFoldersTree();
    await use(filesManagerFoldersTree);
  },
  filesManagerDeleteItemConfirmationPopup: async ({ page }, use) => {
    const filesManagerDeleteItemConfirmationPopup = new ConfirmationPopup(
      page,
      'Delete',
    );
    await use(filesManagerDeleteItemConfirmationPopup);
  },
  filesManagerModal: async ({ page }, use) => {
    const filesManagerModal = new FilesManagerModal(page);
    await use(filesManagerModal);
  },
  filesManagerModalManager: async ({ filesManagerModal }, use) => {
    const filesManagerModalManager = filesManagerModal.getFilesManager();
    await use(filesManagerModalManager);
  },
  filesManagerModalGrid: async ({ filesManagerModalManager }, use) => {
    const filesManagerModalGrid =
      filesManagerModalManager.getFilesManagerGrid();
    await use(filesManagerModalGrid);
  },
  filesManagerModalToolbar: async ({ filesManagerModalManager }, use) => {
    const filesManagerModalToolbar =
      filesManagerModalManager.getFilesManagerToolbar();
    await use(filesManagerModalToolbar);
  },
  filesManagerModalCollapsibleSidebar: async (
    { filesManagerModalManager },
    use,
  ) => {
    const filesManagerModalCollapsibleSidebar =
      filesManagerModalManager.getFilesManagerCollapsibleSidebar();
    await use(filesManagerModalCollapsibleSidebar);
  },
  filesManagerModalFoldersTree: async (
    { filesManagerModalCollapsibleSidebar },
    use,
  ) => {
    const filesManagerModalFoldersTree =
      filesManagerModalCollapsibleSidebar.getFoldersTree();
    await use(filesManagerModalFoldersTree);
  },
  filesManagerDeleteItemConfirmationPopupAssertion: async (
    { filesManagerDeleteItemConfirmationPopup },
    use,
  ) => {
    const filesManagerDeleteItemConfirmationPopupAssertion =
      new ConfirmationPopupAssertion(filesManagerDeleteItemConfirmationPopup);
    await use(filesManagerDeleteItemConfirmationPopupAssertion);
  },
  filesManagerGridAssertion: async ({ filesManagerGrid }, use) => {
    const filesManagerGridAssertion = new FilesManagerGridAssertion(
      filesManagerGrid,
    );
    await use(filesManagerGridAssertion);
  },
  filesManagerModalGridAssertion: async ({ filesManagerModalGrid }, use) => {
    const filesManagerModalGridAssertion = new FilesManagerGridAssertion(
      filesManagerModalGrid,
    );
    await use(filesManagerModalGridAssertion);
  },
  fileConflictConfirmationPopup: async ({ page }, use) => {
    const fileConflictConfirmationPopup = new ConfirmationPopup(
      page,
      'Replace',
    );
    await use(fileConflictConfirmationPopup);
  },
  fileConflictConfirmationPopupAssertion: async (
    { fileConflictConfirmationPopup },
    use,
  ) => {
    const fileConflictConfirmationPopupAssertion =
      new ConfirmationPopupAssertion(fileConflictConfirmationPopup);
    await use(fileConflictConfirmationPopupAssertion);
  },
});

export default dialTest;

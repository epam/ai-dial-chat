import { Conversation } from '@/chat/types/chat';
import { BackendChatEntity, BackendResourceType } from '@/chat/types/common';
import {
  Publication,
  PublicationRequestModel,
  PublishedItem,
} from '@/chat/types/publication';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  MockedChatApiResponseBodies,
  OverlaySandboxUrls,
  PseudoModel,
  ThemeId,
} from '@/src/testData';
import { GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { SortingUtil } from '@/src/utils/sortingUtil';
import {
  ConversationInfo,
  CreateConversationResponse,
  GetConversationsResponse,
  GetMessagesResponse,
  Message,
  OverlayConversation,
  PublishActions,
  SelectConversationResponse,
  UploadStatus,
} from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

const expectedFolderPath = 'test-folder';
const expectedFoldersPath = 'test-inner-folder-root/test-inner-folder-child';

const removeSelectedAddons = (message: Message): Message => {
  if (message.settings) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { selectedAddons, ...restSettings } = message.settings;
    return {
      ...message,
      settings: restSettings,
    };
  }
  return message;
};

dialOverlayTest(
  `[Overlay. Events in sandbox] Send 'Hello' to Chat.\n` +
    '[Overlay. Events in sandbox] Set system prompt.\n' +
    '[Overlay. Events in sandbox] Get messages.\n' +
    '[Overlay. Events in sandbox] Create conversation. Specific for Overlay: new conversation is created each time.\n' +
    `[Overlay. Events in sandbox] Overlay configuration.  Click on "Set light theme and new model" when new conversation is on the screen`,
  async ({
    overlayHomePage,
    overlayHeader,
    overlayIconApiHelper,
    overlayBaseAssertion,
    overlayAgentInfoAssertion,
    overlayAssertion,
    overlayActions,
    overlayConfiguration,
    overlayAgentInfo,
    overlayChat,
    overlayDialog,
    overlayItemApiHelper,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds(
      'EPMDIAL-2332',
      'EPMDIAL-2336',
      'EPMDIAL-2340',
      'EPMDIAL-2335',
      'EPMDIAL-2341',
    );
    const firstRequestContent = 'Hello';
    const secondRequestContent = 'test';
    const systemPrompt = `End each word with string "!?!?!"`;
    let secondRequest: Conversation;
    const configuredModelId = 'gemini-2.5-flash';

    await overlayHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
      { isOverlay: true },
    );

    await dialOverlayTest.step(
      `Click on "Send 'Hello' to Chat" and verify request with correct message is sent`,
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledOnlyHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        const request = await overlayActions.clickSendMessage();
        overlayBaseAssertion.assertValue(
          request.messages[0].content,
          firstRequestContent,
        );
      },
    );

    await dialOverlayTest.step(
      `Click on "Set system prompt', send one more message and verify system prompt is set in the request`,
      async () => {
        await overlayActions.setSysPromptButton.click();
        secondRequest = (await overlayChat.sendRequestWithButton(
          secondRequestContent,
        )) as Conversation;
        const systemMessage = secondRequest.messages.find(
          (m) => m.role === 'system',
        );
        expect.soft(systemMessage).toBeDefined();
        overlayBaseAssertion.assertValue(systemMessage?.content, systemPrompt);
      },
    );

    await dialOverlayTest.step(
      `Click on "Get messages" and verify dialog with conversation messages is displayed`,
      async () => {
        await overlayActions.getMessagesButton.click();
        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');
        const actualMessagesString =
          await overlayDialog.content.getElementInnerContent();
        const expectedItem = await overlayItemApiHelper.getItem<Conversation>(
          secondRequest.id,
        );
        const { messages } = JSON.parse(
          actualMessagesString,
        ) as GetMessagesResponse;
        expect
          .soft(messages)
          .toStrictEqual(expectedItem.messages.map(removeSelectedAddons));
        await overlayDialog.closeButton.click();
      },
    );

    await dialOverlayTest.step(
      `Click on "Create conversation" button two times and verify dialog with conversation is displayed, conversation index is incremented`,
      async () => {
        for (let i = 1; i <= 2; i++) {
          const newConversationData =
            await overlayActions.clickCreateConversation();
          expect
            .soft(
              newConversationData.request.id.endsWith(
                ExpectedConstants.newConversationWithIndexTitle(i),
              ),
            )
            .toBeTruthy();
          await overlayBaseAssertion.assertElementState(
            overlayDialog,
            'visible',
          );
          const actualMessages =
            await overlayDialog.content.getElementInnerContent();
          const expectedConversation: CreateConversationResponse = {
            conversation: {
              model: newConversationData.request.model,
              name: newConversationData.request.name,
              isPlayback: newConversationData.request.isPlayback ?? false,
              isReplay: newConversationData.request.isReplay ?? false,
              id: newConversationData.request.id,
              updatedAt: newConversationData.response.updatedAt,
              folderId: newConversationData.request.folderId,
              bucket: newConversationData.response.bucket,
            },
          };
          expect
            .soft(JSON.parse(actualMessages) as CreateConversationResponse)
            .toStrictEqual(expectedConversation);
          await overlayDialog.closeButton.click();
        }
      },
    );

    await dialOverlayTest.step(
      `Click on "Set light theme and new model" button and verify theme is changed to light, model is added to the recent models`,
      async () => {
        await overlayConfiguration.clickSetConfigurationButton();
        await overlayAssertion.assertOverlayTheme(
          overlayHomePage,
          ThemeId.light,
        );
        await overlayBaseAssertion.assertElementText(
          overlayAgentInfo.agentName,
          ModelsUtil.getDefaultAgent()!.name,
        );
        const settings = await localStorageManager.getSettings(
          process.env.NEXT_PUBLIC_OVERLAY_HOST,
        );
        overlayBaseAssertion.assertValue(settings.theme, ThemeId.light);
        const recentModels = await localStorageManager.getRecentModelsIds(
          process.env.NEXT_PUBLIC_OVERLAY_HOST,
        );
        overlayBaseAssertion.assertValue(recentModels[0], configuredModelId);
      },
    );

    await dialOverlayTest.step(
      `Click on "Create new conversation" button and verify new model is applied`,
      async () => {
        const expectedModel = ModelsUtil.getModel(configuredModelId)!;
        const expectedModelIcon = expectedModel.iconUrl;
        await overlayHeader.createNewConversation({
          triggeredHttpHost: expectedModelIcon
            ? API.themeUrl.concat(`/${expectedModelIcon}`)
            : undefined,
        });
        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        overlayBaseAssertion.assertValue(
          selectedConversationIds[0],
          `conversations/local/${expectedModel.reference}__${ExpectedConstants.newConversationWithIndexTitle(3)}`,
        );
        await overlayAgentInfoAssertion.assertElementText(
          overlayAgentInfo.agentName,
          expectedModel.name,
        );
        await overlayAgentInfoAssertion.assertShortDescription(expectedModel);
        await overlayAgentInfoAssertion.assertAgentIcon(
          overlayIconApiHelper.getEntityIcon(expectedModel),
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Select conversation and its json appears if to click on Select conversation by ID.\n' +
    '[Overlay. Events in sandbox] Get conversations',
  async ({
    overlayHomePage,
    overlayActions,
    overlayDialog,
    overlayPublicationApiHelper,
    conversationData,
    overlayChatHeader,
    overlayBaseAssertion,
    localStorageManager,
    overlayDataInjector,
    overlayShareApiHelper,
    overlayItemApiHelper,
    setTestIds,
    adminShareApiHelper,
    adminPublicationApiHelper,
    adminDataInjector,
    publishRequestBuilder,
  }) => {
    setTestIds('EPMDIAL-2339', 'EPMDIAL-2334');
    let todayConversation: Conversation;
    let folderConversation: FolderConversation;
    let publishedConversation: Conversation;
    let sharedConversation: Conversation;
    const expectedConversationsArray: (OverlayConversation | Conversation)[] =
      [];
    let expectedSelectedConversation: SelectConversationResponse;

    await dialOverlayTest.step(
      `Prepare conversations in Today, Pinned, Organization and Shared sections`,
      async () => {
        todayConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        folderConversation =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();
        publishedConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        sharedConversation = conversationData.prepareDefaultConversation();
        await overlayDataInjector.createConversations([
          todayConversation,
          ...folderConversation.conversations,
        ]);
        await adminDataInjector.createConversations([
          publishedConversation,
          sharedConversation,
        ]);
        //publish conversation by admin
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationInFolderResource(
            publishedConversation,
            PublishActions.ADD,
          )
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
        //share conversation by admin
        const shareByLinkResponse = await adminShareApiHelper.shareEntityByLink(
          [sharedConversation],
        );
        await overlayShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialOverlayTest.step(
      `Click "Get conversations" button and verify dialog with conversations is displayed`,
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayActions.getConversationsButton.click();
        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');
        const actualConversations =
          await overlayDialog.content.getElementInnerContent();
        const actualConversationsModels = JSON.parse(
          actualConversations,
        ) as GetConversationsResponse;

        const expectedConversationsModel = {
          conversations: expectedConversationsArray,
        };

        //build expected conversations published to user
        const actualPublishedConversationsList =
          await overlayPublicationApiHelper.listPublishedResources(
            BackendResourceType.CONVERSATION,
          );
        for (const actualPublishedConversation of actualPublishedConversationsList.items!) {
          const conversation =
            await overlayPublicationApiHelper.getPublishedConversation(
              actualPublishedConversation.url,
            );
          const permissions = conversation.permissions;
          const isPlayback = conversation.playback?.isPlayback;
          const isReplay = conversation.replay?.isReplay;
          const parentPath = actualPublishedConversation.parentPath;
          expectedConversationsArray.push({
            model: isPlayback
              ? { id: PseudoModel.playback }
              : isReplay
                ? { id: PseudoModel.replay }
                : conversation.model,
            name: conversation.name,
            isPlayback: isPlayback ?? false,
            isReplay: isReplay ?? false,
            publicationInfo: {
              version: actualPublishedConversation.name.substring(
                actualPublishedConversation.name.lastIndexOf(
                  ItemUtil.entityIdSeparator,
                ) + ItemUtil.entityIdSeparator.length,
              ),
            },
            id: conversation.id,
            folderId: conversation.folderId,
            publishedWithMe: !parentPath,
            updatedAt: actualPublishedConversation.updatedAt,
            bucket: actualPublishedConversation.bucket,
            ...(parentPath && { parentPath }),
            ...(permissions && { permissions }),
          });
        }

        //build expected conversations created by user
        let actualConversationsList = await overlayItemApiHelper.listItems(
          API.conversationsHost(),
        );
        //need to sort conversations by 'updatedAt' and 'name' in order to define the last conversation
        actualConversationsList =
          SortingUtil.sortBackendConversationsByDateAndName(
            actualConversationsList,
          );
        for (let i = 0; i < actualConversationsList.length; i++) {
          let expectedConversation: OverlayConversation | Conversation;
          const conversation = await overlayItemApiHelper.getItem<Conversation>(
            actualConversationsList[i].url,
          );
          const actualConversation = actualConversationsList[i];
          const parentPath = actualConversation.parentPath;
          const permissions = actualConversation.permissions;
          const bucket = actualConversation.bucket;
          const shortConversation: ConversationInfo = {
            model: conversation.model,
            name: conversation.name,
            isPlayback: conversation.playback?.isPlayback ?? false,
            isReplay: conversation.replay?.isReplay ?? false,
            id: conversation.id,
            updatedAt: actualConversation.updatedAt,
            folderId: conversation.folderId,
          };

          //save expectedSelectedConversation for the next test step if it is not last listed one
          if (shortConversation.id === todayConversation.id) {
            const expectedSelectedOverlayConversation = {
              ...shortConversation,
              ...(permissions && { permissions }),
              ...(bucket && { bucket }),
            };
            expectedSelectedConversation = {
              conversation:
                expectedSelectedOverlayConversation as OverlayConversation,
            };
          }

          //for the last listed conversation full response is generated
          let fullConversation: Conversation;
          if (i === 0) {
            fullConversation = {
              ...shortConversation,
              messages: conversation.messages,
              prompt: conversation.prompt,
              temperature: conversation.temperature,
              replay: conversation.replay,
              selectedAddons: [],
              status: UploadStatus.LOADED,
              isMessageStreaming: false,
            };
            expectedConversation = {
              ...fullConversation,
              bucket: actualConversation.bucket,
              ...(parentPath && { parentPath }),
              ...(permissions && { permissions }),
            };

            //save expectedSelectedConversation for the next test step if it is the last listed one
            if (expectedConversation.id === todayConversation.id) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { parentPath, ...conversationInfo } = expectedConversation;
              expectedSelectedConversation = {
                conversation: conversationInfo as OverlayConversation,
              };
            }
          } else {
            expectedConversation = {
              ...shortConversation,
              bucket: actualConversation.bucket,
              ...(parentPath && { parentPath }),
              ...(permissions && { permissions }),
            };
          }
          expectedConversationsArray.push(expectedConversation);
        }

        //build expected conversations shared with user
        const actualSharedConversationsList =
          await overlayShareApiHelper.listSharedWithMeConversations();
        for (const actualSharedConversation of actualSharedConversationsList.resources) {
          const conversation = await overlayItemApiHelper.getItem<Conversation>(
            actualSharedConversation.url,
          );
          const permissions = conversation.permissions;
          expectedConversationsArray.push({
            model: conversation.model,
            name: conversation.name,
            isPlayback: conversation.playback?.isPlayback ?? false,
            isReplay: conversation.replay?.isReplay ?? false,
            id: conversation.id,
            folderId: conversation.folderId,
            sharedWithMe: true,
            bucket: actualSharedConversation.bucket,
            ...(permissions && { permissions }),
          });
        }

        //compare conversations from bucket storage
        overlayBaseAssertion.assertValue(
          actualConversationsModels.conversations.length,
          expectedConversationsModel.conversations.length + 1,
        );
        overlayBaseAssertion.assertArrayIncludesAll(
          actualConversationsModels.conversations,
          expectedConversationsModel.conversations,
          ExpectedMessages.conversationsListIsValid,
        );

        //check newly created 'New conversation 1' is displayed
        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        actualConversationsModels.conversations.find(
          (c) => c.id === selectedConversationIds[0],
        );
        overlayBaseAssertion.assertValueIsNotUndefined(
          actualConversationsModels.conversations.find(
            (c) => c.id === selectedConversationIds[0],
          ),
        );
        await overlayDialog.closeButton.click();
      },
    );

    await dialOverlayTest.step(
      `Set id into "Select conversation by ID" field and verify conversation is selected, dialog with conversation is displayed`,
      async () => {
        await overlayActions.conversationIdField.fillInInput(
          todayConversation.id,
        );
        await overlayActions.selectConversationByIdButton.click();

        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');
        const actualConversation =
          await overlayDialog.content.getElementInnerContent();
        const actualConversationModel = JSON.parse(
          actualConversation,
        ) as OverlayConversation;
        overlayBaseAssertion.assertValuesAreEqual(
          actualConversationModel,
          expectedSelectedConversation.conversation,
        );
        await overlayDialog.closeButton.click();

        await overlayBaseAssertion.assertElementText(
          overlayChatHeader.chatTitle,
          todayConversation.name,
        );
        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        overlayBaseAssertion.assertValue(
          selectedConversationIds[0],
          todayConversation.id,
        );
      },
    );
  },
);

dialOverlayTest(
  `[Overlay. Events in sandbox] New conversation is created in new folder if to click on 'Create conversation in inner folder' event. Folders are expanded.\n` +
    `[Overlay. Events in sandbox] DIAL auto-scrolls to new conversation on 'Create conversation in inner folder'`,
  async ({
    overlayHomePage,
    overlayHeader,
    overlayBaseAssertion,
    overlayActions,
    overlayDialog,
    overlayChatBarFolderAssertion,
    conversationData,
    overlayDataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2343', 'EPMDIAL-2345');

    await dialOverlayTest.step(
      'Create set of conversations in folders',
      async () => {
        for (let i = 1; i <= 15; i++) {
          const conversationInFolder =
            conversationData.prepareDefaultConversationInFolder();
          await overlayDataInjector.createConversations(
            conversationInFolder.conversations,
            conversationInFolder.folders,
          );
          conversationData.resetData();
        }
      },
    );

    await dialOverlayTest.step(
      `Click on "Create conversation in inner folder" and verify modal with conversation json is opened`,
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        const newConversationData =
          await overlayActions.clickCreateConversationInInnerFolder(
            expectedFoldersPath,
          );
        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');
        const actualMessages =
          await overlayDialog.content.getElementInnerContent();
        const expectedConversation: CreateConversationResponse = {
          conversation: {
            model: newConversationData.request.model,
            name: newConversationData.request.name,
            isPlayback: newConversationData.request.isPlayback ?? false,
            isReplay: newConversationData.request.isReplay ?? false,
            id: newConversationData.request.id,
            updatedAt: newConversationData.response.updatedAt,
            folderId: newConversationData.request.folderId,
            bucket: newConversationData.response.bucket,
            parentPath: newConversationData.response.parentPath,
          },
        };
        expect
          .soft(
            expectedConversation.conversation.id.includes(expectedFoldersPath),
          )
          .toBeTruthy();
        expect
          .soft(
            expectedConversation.conversation.folderId.endsWith(
              expectedFoldersPath,
            ),
          )
          .toBeTruthy();
        expect
          .soft(expectedConversation.conversation.parentPath)
          .toBe(expectedFoldersPath);
        expect
          .soft(JSON.parse(actualMessages) as CreateConversationResponse)
          .toStrictEqual(expectedConversation);
        await overlayDialog.closeButton.click();
      },
    );

    await dialOverlayTest.step(
      `Open chat panel and verify created conversation is selected and focused`,
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayChatBarFolderAssertion.assertRootFolderState(
          { name: expectedFoldersPath.split('/')[0] },
          'visible',
        );
        await overlayChatBarFolderAssertion.assertFolderEntitySelectedState(
          { name: expectedFoldersPath.split('/')[1] },
          { name: ExpectedConstants.newConversationWithIndexTitle(1) },
          true,
        );
        await overlayChatBarFolderAssertion.assertFolderEntityIsInViewport(
          { name: expectedFoldersPath.split('/')[1] },
          { name: ExpectedConstants.newConversationWithIndexTitle(1) },
          1,
        );
      },
    );
  },
);

dialOverlayTest(
  `[Overlay. Events in sandbox] New conversation name is unique inside in new folder if to click on 'Create conversation in inner folder' event`,
  async ({
    overlayHomePage,
    overlayHeader,
    overlayBaseAssertion,
    overlayActions,
    overlayDialog,
    overlayChatBarFolderAssertion,
    conversationData,
    overlayDataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2344');

    await dialOverlayTest.step(
      'Create a conversation with "New conversation 2" name in Today section',
      async () => {
        const todayConversation = conversationData.prepareDefaultConversation(
          undefined,
          ExpectedConstants.newConversationWithIndexTitle(2),
        );
        await overlayDataInjector.createConversations([todayConversation]);
      },
    );

    await dialOverlayTest.step(
      `Click on "Create conversation in inner folder" twice and verify conversation index is incremented according to folder content`,
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        for (let i = 1; i <= 2; i++) {
          await overlayActions.clickCreateConversationInInnerFolder(
            expectedFoldersPath,
          );
          await overlayBaseAssertion.assertElementState(
            overlayDialog,
            'visible',
          );
          await overlayDialog.closeButton.click();
        }
        await overlayHeader.leftPanelToggle.click();
        const innerFolderName = expectedFoldersPath.split('/')[1];

        for (let i = 1; i <= 2; i++) {
          await overlayChatBarFolderAssertion.assertFolderEntityState(
            { name: innerFolderName },
            { name: ExpectedConstants.newConversationWithIndexTitle(i) },
            'visible',
          );
        }
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Chat1 is created into new folder. Chat2 is created into the same folder. Event: newConversationsFolderIdSetOverlay.\n' +
    '[Overlay. Events in sandbox] Delete conversation by ID',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayChatBar,
    overlayTalkToAgentDialog,
    overlaySendMessage,
    overlayChatBarFolderAssertion,
    overlayFolderConversations,
    overlayBaseAssertion,
    overlayChat,
    overlayItemApiHelper,
    overlayActions,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2346', 'EPMDIAL-2350');
    const firstConversationName = GeneratorUtil.randomString(7);
    const secondConversationName = GeneratorUtil.randomString(7);

    await overlayHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
      { isOverlay: true },
    );

    await dialOverlayTest.step('Send a request to the chat', async () => {
      await overlayHomePage.navigateToUrl(
        OverlaySandboxUrls.newConversationsFolderIdSetUrl,
      );
      await overlayHomePage.waitForPageLoaded();
      await overlayChat.sendRequestWithButton(firstConversationName);
    });

    await dialOverlayTest.step(
      'Open chat panel and verify conversation is created inside configured folder',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        //TODO: remove page reload and folder expand when the issue is fixed https://github.com/epam/ai-dial-chat/issues/3776
        await overlayHomePage.reloadPage();
        await overlayHomePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage,
          'visible',
        );
        await overlayHeader.leftPanelToggle.click();
        await overlayFolderConversations.expandFolder(expectedFolderPath);
        await overlayChatBarFolderAssertion.assertFolderEntityState(
          { name: expectedFolderPath },
          { name: firstConversationName },
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Create one more new conversation and verify it is created inside configured folder',
      async () => {
        await overlayChatBar.createNewEntity();
        await overlayTalkToAgentDialog.getCloseButton().click();
        await overlayChat.sendRequestWithButton(secondConversationName);
        await overlayHeader.leftPanelToggle.click();
        await overlayChatBarFolderAssertion.assertFolderEntityState(
          { name: expectedFolderPath },
          { name: secondConversationName },
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Set created conversation id into the text field, click "Delete conversation by ID" btn and it is deleted from the folder',
      async () => {
        const conversationsList = await overlayItemApiHelper.listItems(
          API.conversationsHost(),
        );
        const conversationToDeleteModel = conversationsList.find((c) =>
          c.name.endsWith(secondConversationName),
        )!;
        await overlayActions.conversationIdField.fillInInput(
          conversationToDeleteModel.url,
        );
        await overlayActions.clickDeleteConversationById();
        await overlayHeader.leftPanelToggle.click();
        await overlayChatBarFolderAssertion.assertFolderEntityState(
          { name: expectedFolderPath },
          { name: secondConversationName },
          'hidden',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Create local conversation',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    localStorageManager,
    overlaySendMessage,
    overlayChatBarFolderAssertion,
    overlayFolderConversations,
    overlayAgentInfo,
    overlayAgentInfoAssertion,
    overlayBaseAssertion,
    overlayChat,
    conversationData,
    overlayDataInjector,
    overlayActions,
    overlayDialog,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2347');
    let todayConversation: Conversation;
    const defaultModelId = ModelsUtil.getDefaultAgent()!.reference;
    const expectedConversationName =
      ExpectedConstants.newConversationWithIndexTitle(1);
    const expectedConversationId = `${ExpectedConstants.localFolderIdPath()}/${defaultModelId}__${expectedConversationName}`;

    await overlayHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
      { isOverlay: true },
    );

    await dialOverlayTest.step(
      'Prepare a conversation in Today section',
      async () => {
        todayConversation = conversationData.prepareDefaultConversation();
        await overlayDataInjector.createConversations([todayConversation]);
      },
    );

    await dialOverlayTest.step('Select prepared chat', async () => {
      await overlayHomePage.navigateToUrl(
        OverlaySandboxUrls.newConversationsFolderIdSetUrl,
      );
      await overlayHomePage.waitForPageLoaded();
      await overlayHeader.leftPanelToggle.click();
      await overlayConversations.selectEntity(todayConversation.name);
    });

    await dialOverlayTest.step(
      'Click on "Create local conversation" btn and verify new conversation is created, modal with conversation json is opened',
      async () => {
        await overlayActions.createLocalConversationButton.click();
        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');

        const expectedConversation = {
          conversation: {
            isShared: false,
            publishedWithMe: false,
            sharedWithMe: false,
            name: expectedConversationName,
            messages: [],
            model: { id: defaultModelId },
            prompt: '',
            temperature: +ExpectedConstants.defaultTemperature,
            status: UploadStatus.LOADED,
            folderId: ExpectedConstants.localFolderIdPath(),
            id: expectedConversationId,
            bucket: ExpectedConstants.localBucket,
          },
        };
        const actualMessages =
          await overlayDialog.content.getElementInnerContent();
        overlayBaseAssertion.assertValueMatchObject(
          JSON.parse(actualMessages) as CreateConversationResponse,
          expectedConversation,
        );
        await overlayDialog.closeButton.click();

        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        overlayBaseAssertion.assertValue(
          selectedConversationIds[0],
          expectedConversationId,
        );
        await overlayAgentInfoAssertion.assertElementState(
          overlayAgentInfo,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Send any message to the chat and verify the conversation is moved under the configured folder',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        const newConversationName = GeneratorUtil.randomString(6);
        await overlayChat.sendRequestWithButton(newConversationName);
        //TODO: remove page reload and folder expand when the issue is fixed https://github.com/epam/ai-dial-chat/issues/3776
        await overlayHomePage.reloadPage();
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayFolderConversations.expandFolder(expectedFolderPath);
        await overlayChatBarFolderAssertion.assertFolderEntityState(
          { name: expectedFolderPath },
          { name: newConversationName },
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Get selected conversations',
  async ({
    overlayHomePage,
    overlayActions,
    overlayDialog,
    conversationData,
    overlayFolderConversations,
    overlaySharedWithMeConversations,
    overlayHeader,
    overlayOrganizationConversations,
    overlayPublicationApiHelper,
    overlayBaseAssertion,
    overlayChatBar,
    overlayDataInjector,
    overlayShareApiHelper,
    overlayItemApiHelper,
    setTestIds,
    adminShareApiHelper,
    adminPublicationApiHelper,
    adminDataInjector,
    publishRequestBuilder,
  }) => {
    setTestIds('EPMDIAL-2349');
    let folderConversation: FolderConversation;
    let publishedConversation: Conversation;
    let sharedConversation: Conversation;

    await dialOverlayTest.step(
      `Prepare conversations in Pinned, Organization and Shared sections`,
      async () => {
        //create conversation in the folder
        folderConversation =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();
        publishedConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        sharedConversation = conversationData.prepareDefaultConversation();
        await overlayDataInjector.createConversations([
          ...folderConversation.conversations,
        ]);
        await adminDataInjector.createConversations([
          publishedConversation,
          sharedConversation,
        ]);
        //publish conversation by admin
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationInFolderResource(
            publishedConversation,
            PublishActions.ADD,
          )
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
        //share conversation by admin
        const shareByLinkResponse = await adminShareApiHelper.shareEntityByLink(
          [sharedConversation],
        );
        await overlayShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    // Generic test function
    async function testSelectedConversation(
      testName: string,
      conversationType: 'pinned' | 'shared' | 'organization',
      setupAction: () => Promise<void>,
      getApiData: () => Promise<{
        conversation: Conversation;
        conversationFromList: BackendChatEntity | PublishedItem;
      }>,
    ) {
      await dialOverlayTest.step(testName, async () => {
        // Setup and select conversation
        await setupAction();
        await overlayBaseAssertion.assertElementState(overlayChatBar, 'hidden');

        // Get selected conversation json
        await overlayActions.getSelectedConversationsButton.click();
        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');

        // Parse actual json
        const actualConversations =
          await overlayDialog.content.getElementInnerContent();
        const actualConversationModel = JSON.parse(
          actualConversations,
        ) as GetConversationsResponse;

        // Get API data and build expected model
        const {
          conversation: apiConversation,
          conversationFromList: apiConversationFromList,
        } = await getApiData();
        const expectedConversationModel = buildExpectedConversationModel(
          apiConversation,
          apiConversationFromList,
          conversationType,
        );

        // assertions the result
        overlayBaseAssertion.assertValue(
          actualConversationModel.conversations.length,
          1,
        );
        overlayBaseAssertion.assertValuesAreEqual(
          actualConversationModel.conversations[0],
          expectedConversationModel,
        );
        await overlayDialog.closeButton.click();
      });
    }

    await testSelectedConversation(
      `Select conversation from "Pinned" section, click on "Get selected conversations" btn and verify dialog with conversation json is displayed`,
      'pinned',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayFolderConversations.expandFolder(
          folderConversation.folders.name,
        );
        await overlayFolderConversations.selectFolderEntity(
          folderConversation.folders.name,
          folderConversation.conversations[0].name,
        );
      },
      async () => {
        const apiConversationsList = await overlayItemApiHelper.listItems(
          API.conversationsHost(),
        );
        const apiConversationFromList = apiConversationsList.find(
          (c) => c.url === folderConversation.conversations[0].id,
        )!;
        const apiConversation = (await overlayItemApiHelper.getItem(
          apiConversationFromList.url,
        )) as Conversation;
        return {
          conversation: apiConversation,
          conversationFromList: apiConversationFromList,
        };
      },
    );

    await testSelectedConversation(
      `Select conversation from "Shared with me" section, click on "Get selected conversations" btn and verify dialog with conversation json is displayed`,
      'shared',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlaySharedWithMeConversations.selectEntity(
          sharedConversation.name,
          { isHttpMethodTriggered: true },
        );
      },
      async () => {
        const apiSharedConversationsList =
          await overlayShareApiHelper.listSharedWithMeConversations();
        const apiSharedConversationFromList =
          apiSharedConversationsList.resources.find(
            (c) => c.url === sharedConversation.id,
          )!;
        const apiSharedConversation = (await overlayItemApiHelper.getItem(
          apiSharedConversationFromList.url,
        )) as Conversation;
        return {
          conversation: apiSharedConversation,
          conversationFromList: apiSharedConversationFromList,
        };
      },
    );

    await testSelectedConversation(
      `Select conversation from "Organization" section, click on "Get selected conversations" btn and verify dialog with conversation json is displayed`,
      'organization',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayOrganizationConversations.selectEntity(
          publishedConversation.name,
          { isHttpMethodTriggered: true },
        );
      },
      async () => {
        const apiPublishedConversationsList =
          (await overlayPublicationApiHelper.listPublishedResources(
            BackendResourceType.CONVERSATION,
          ))!;
        const apiPublishedConversationFromList =
          apiPublishedConversationsList.items!.find((i) =>
            i.name.includes(publishedConversation.name),
          )!;
        const apiPublishedConversation =
          await overlayPublicationApiHelper.getPublishedConversation(
            apiPublishedConversationFromList.url,
          );
        return {
          conversation: apiPublishedConversation,
          conversationFromList: apiPublishedConversationFromList,
        };
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Playback, Replay, Duplicated, Imported chats appears in the Folder set in API',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlayConversationDropdownMenu,
    overlayChatBarFolderAssertion,
    overlayFolderConversations,
    conversationData,
    overlayDataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2348');
    let todayConversation: Conversation;

    await dialOverlayTest.step(
      'Prepare a conversation in Today section',
      async () => {
        todayConversation = conversationData.prepareDefaultConversation();
        await overlayDataInjector.createConversations([todayConversation]);
      },
    );

    await dialOverlayTest.step(
      'Open DIAL and duplicate prepared conversation, create Playback, Replay conversations based on it',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.newConversationsFolderIdSetUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        //TODO: need to add conversation export/import step when fixed https://github.com/epam/ai-dial-chat/issues/4030
        for (const menuOption of [
          MenuOptions.duplicate,
          MenuOptions.playback,
          MenuOptions.replay,
        ]) {
          await overlayHeader.leftPanelToggle.click();
          await overlayConversations
            .getTreeEntity(todayConversation.name, { exactMatch: true })
            .hover();
          await overlayConversations
            .entityDotsMenu(todayConversation.name, { exactMatch: true })
            .click();
          await overlayConversationDropdownMenu.selectMenuOption(menuOption, {
            triggeredHttpMethod: 'POST',
          });
        }
      },
    );

    await dialOverlayTest.step(
      'Verify all conversations are created inside configured folder',
      async () => {
        //TODO: remove the next line when fixed https://github.com/epam/ai-dial-chat/issues/3776
        await overlayHomePage.reloadPage();
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayFolderConversations.expandFolder(expectedFolderPath);
        await overlayChatBarFolderAssertion.assertFolderEntityState(
          { name: expectedFolderPath },
          { name: todayConversation.name },
          'visible',
        );
        await overlayChatBarFolderAssertion.assertFolderEntityState(
          { name: expectedFolderPath },
          {
            name: `${ExpectedConstants.playbackConversation}${todayConversation.name}`,
          },
          'visible',
        );
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/4030
        // await overlayChatBarFolderAssertion.assertFolderEntityState(
        //   { name: expectedFolderPath },
        //   {
        //     name: `${ExpectedConstants.replayConversation}${todayConversation}`,
        //   },
        //   'visible',
        // );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Create playback conversation by source conversation ID',
  async ({
    overlayHomePage,
    overlayActions,
    overlayDialog,
    conversationData,
    overlayBaseAssertion,
    overlayDataInjector,
    overlayShareApiHelper,
    overlayItemApiHelper,
    setTestIds,
    adminShareApiHelper,
    adminPublicationApiHelper,
    adminDataInjector,
    publishRequestBuilder,
  }) => {
    setTestIds('EPMDIAL-2352');
    let folderConversation: FolderConversation;
    let publishedConversation: Conversation;
    let publishRequest: PublicationRequestModel;
    let publication: Publication;
    let sharedConversation: Conversation;

    await dialOverlayTest.step(
      `Prepare conversations in Pinned, Organization and Shared sections`,
      async () => {
        //create conversation in the folder
        folderConversation =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();
        publishedConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        sharedConversation = conversationData.prepareDefaultConversation();
        await overlayDataInjector.createConversations([
          ...folderConversation.conversations,
        ]);
        await adminDataInjector.createConversations([
          publishedConversation,
          sharedConversation,
        ]);
        //publish conversation by admin
        publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationInFolderResource(
            publishedConversation,
            PublishActions.ADD,
          )
          .build();
        publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
        //share conversation by admin
        const shareByLinkResponse = await adminShareApiHelper.shareEntityByLink(
          [sharedConversation],
        );
        await overlayShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    const createExpectedConversationModel = (
      apiConversation: Conversation,
      apiConversationFromList: BackendChatEntity,
      playbackRequestResponse: {
        request: Conversation;
        response: BackendChatEntity;
      },
      additionalProps: Record<string, unknown> = {},
    ) => {
      const isReplay = apiConversation.replay?.isReplay;
      const replay = isReplay ? apiConversation.replay : { isReplay: false };

      return {
        model: apiConversation.model,
        name: apiConversation.name,
        isPlayback: apiConversation.playback?.isPlayback ?? false,
        isReplay: isReplay ?? false,
        id: apiConversation.id,
        updatedAt: playbackRequestResponse.response.updatedAt,
        folderId: apiConversation.folderId,
        prompt: apiConversation.prompt,
        temperature: apiConversation.temperature,
        replay,
        messages: apiConversation.messages,
        selectedAddons: apiConversation.selectedAddons,
        status: UploadStatus.LOADED,
        isShared: false,
        sharedWithMe: false,
        publishedWithMe: false,
        reference: apiConversation.reference,
        playback: apiConversation.playback,
        bucket: apiConversationFromList.bucket,
        ...additionalProps,
      };
    };

    const testPlaybackConversation = async (
      conversationId: string,
      expectedNameSuffix: string,
      getAdditionalProps?: (data: {
        apiConversation?: Conversation;
        apiConversationFromList?: BackendChatEntity;
      }) => Record<string, unknown>,
    ) => {
      await overlayActions.conversationIdField.fillInInput(conversationId);
      const playbackRequestResponse =
        await overlayActions.clickPlaybackConversationById();
      await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');

      // Parse actual JSON
      const actualConversations =
        await overlayDialog.content.getElementInnerContent();
      const actualConversationModel = JSON.parse(
        actualConversations,
      ) as OverlayConversation;

      // Get API conversation
      const apiConversationsList = await overlayItemApiHelper.listItems(
        API.conversationsHost(),
      );
      const apiConversationFromList = apiConversationsList.find((c) =>
        c.name.endsWith(expectedNameSuffix),
      )!;
      const apiConversation = (await overlayItemApiHelper.getItem(
        apiConversationFromList.url,
      )) as Conversation;

      // Get additional properties if function provided
      const additionalProps = getAdditionalProps
        ? getAdditionalProps({ apiConversation, apiConversationFromList })
        : {};

      // Create expected model
      const expectedConversationModel = createExpectedConversationModel(
        apiConversation,
        apiConversationFromList,
        playbackRequestResponse,
        additionalProps,
      );
      overlayBaseAssertion.assertValuesAreEqual(
        actualConversationModel,
        expectedConversationModel,
      );
      await overlayDialog.closeButton.click();
    };

    await dialOverlayTest.step('Open overlay home page', async () => {
      await overlayHomePage.navigateToUrl(
        OverlaySandboxUrls.enabledHeaderSandboxUrl,
      );
      await overlayHomePage.waitForPageLoaded();
    });

    await dialOverlayTest.step(
      'Set folder conversation id in the field, click on "Create playback conversation by source conversation ID" btn and verify playback json is displayed on the modal',
      async () => {
        const expectedNameSuffix =
          ExpectedConstants.playbackConversation.concat(
            folderConversation.conversations[0].name,
          );
        await testPlaybackConversation(
          folderConversation.conversations[0].id,
          expectedNameSuffix,
          ({ apiConversationFromList }) => ({
            isMessageStreaming: false,
            permissions: apiConversationFromList!.permissions,
            parentPath: apiConversationFromList!.parentPath,
          }),
        );
      },
    );

    await dialOverlayTest.step(
      'Set published conversation id in the field, click on "Create playback conversation by source conversation ID" btn and verify playback json is displayed on the modal',
      async () => {
        const publishedConversationId = publication.resources.find((r) =>
          r.targetUrl.includes(publishedConversation.name),
        )!.targetUrl;
        const expectedNameSuffix = `${ExpectedConstants.playbackConversation}${publishedConversation.name}${ItemUtil.entityIdSeparator}${ExpectedConstants.defaultEntityVersion}`;
        await testPlaybackConversation(
          publishedConversationId,
          expectedNameSuffix,
          ({ apiConversation }) => ({
            publicationInfo: {
              version: apiConversation!.id.substring(
                apiConversation!.id.lastIndexOf(ItemUtil.entityIdSeparator) +
                  ItemUtil.entityIdSeparator.length,
              ),
            },
          }),
        );
      },
    );

    await dialOverlayTest.step(
      'Set shared conversation id in the field, click on "Create playback conversation by source conversation ID" btn and verify playback json is displayed on the modal',
      async () => {
        const expectedNameSuffix =
          ExpectedConstants.playbackConversation.concat(
            sharedConversation.name,
          );
        await testPlaybackConversation(
          sharedConversation.id,
          expectedNameSuffix,
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Rename conversation by source conversation ID. Chat with history',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayFolderConversations,
    overlayChatBarFolderAssertion,
    overlayActions,
    overlayDialog,
    conversationData,
    overlayBaseAssertion,
    overlayDataInjector,
    overlayItemApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2354');
    let folderConversation: FolderConversation;
    const newConversationWithHistoryName = GeneratorUtil.randomString(7);

    await dialOverlayTest.step(
      'Prepare conversations in Pinned section',
      async () => {
        //create conversation in the folder
        folderConversation =
          conversationData.prepareDefaultConversationInFolder();
        await overlayDataInjector.createConversations([
          ...folderConversation.conversations,
        ]);
      },
    );

    await dialOverlayTest.step(
      'Open DIAL, set conversation id and new name in the fields, click on "Rename conversation by source conversation ID" btn and verify conversation json with updated name is displayed',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayActions.conversationIdField.fillInInput(
          folderConversation.conversations[0].id,
        );
        await overlayActions.newConversationNameField.fillInInput(
          newConversationWithHistoryName,
        );
        const updateRequestResponse =
          await overlayActions.clickRenameConversationById();
        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');

        // Parse actual json
        const actualConversations =
          await overlayDialog.content.getElementInnerContent();
        const actualConversationModel = JSON.parse(
          actualConversations,
        ) as OverlayConversation;

        const apiConversationsList = await overlayItemApiHelper.listItems(
          API.conversationsHost(),
        );
        const apiConversationFromList = apiConversationsList.find(
          (c) => c.url === updateRequestResponse.response.url,
        )!;

        const expectedConversationModel = {
          model: updateRequestResponse.request.model,
          name: newConversationWithHistoryName,
          isPlayback:
            updateRequestResponse.request.playback?.isPlayback ?? false,
          isReplay: updateRequestResponse.request.replay?.isReplay ?? false,
          id: updateRequestResponse.request.id,
          updatedAt: updateRequestResponse.response.updatedAt,
          folderId: updateRequestResponse.request.folderId,
          permissions: apiConversationFromList.permissions,
          prompt: updateRequestResponse.request.prompt,
          temperature: updateRequestResponse.request.temperature,
          replay: updateRequestResponse.request.replay?.isReplay
            ? updateRequestResponse.request.replay
            : { isReplay: false },
          messages: updateRequestResponse.request.messages,
          selectedAddons: updateRequestResponse.request.selectedAddons,
          status: UploadStatus.LOADED,
          isMessageStreaming: false,
          createdAt: updateRequestResponse.response.createdAt,
          //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/4173
          // isNameChanged: true,
          bucket: updateRequestResponse.response.bucket,
          parentPath: updateRequestResponse.response.parentPath,
        };

        overlayBaseAssertion.assertValuesAreEqual(
          actualConversationModel,
          expectedConversationModel,
        );
        await overlayDialog.closeButton.click();
      },
    );

    await dialOverlayTest.step(
      'Verify conversation name is changed on the left side panel',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayFolderConversations.expandFolder(
          folderConversation.folders.name,
        );
        await overlayChatBarFolderAssertion.assertFolderEntityState(
          { name: folderConversation.folders.name },
          { name: newConversationWithHistoryName },
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay. Events in sandbox] Rename conversation by source conversation ID. New chat without history',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayChat,
    overlayConversationAssertion,
    overlayActions,
    overlayDialog,
    overlayItemApiHelper,
    overlayBaseAssertion,
    overlayChatHeaderAssertion,
    localStorageManager,
    setTestIds,
    setIssueIds,
  }) => {
    setIssueIds('4173');
    setTestIds('EPMDIAL-2355');
    const newEmptyConversationName = GeneratorUtil.randomString(7);

    await dialOverlayTest.step(
      'Set local conversation id and new name in the fields, click on "Rename conversation by source conversation ID" btn and verify nothing happens',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        await overlayActions.conversationIdField.fillInInput(
          selectedConversationIds[0],
        );
        await overlayActions.newConversationNameField.fillInInput(
          newEmptyConversationName,
        );
        await overlayActions.renameConversationByIdButton.click();
        await overlayBaseAssertion.assertElementState(overlayDialog, 'hidden');
      },
    );

    await dialOverlayTest.step(
      'Send some request to the chat and verify updated conversation name is set, conversation json is displayed',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        await overlayChat.sendRequestWithButton(GeneratorUtil.randomString(5));
        await overlayBaseAssertion.assertElementState(overlayDialog, 'visible');
        const actualConversation =
          await overlayDialog.content.getElementInnerContent();

        const apiConversationsList = await overlayItemApiHelper.listItems(
          API.conversationsHost(),
        );
        const apiConversationFromList = apiConversationsList.find((c) =>
          c.name.endsWith(newEmptyConversationName),
        )!;
        const apiConversation = (await overlayItemApiHelper.getItem(
          apiConversationFromList.url,
        )) as Conversation;

        const expectedConversationModel = {
          isShared: false,
          publishedWithMe: false,
          sharedWithMe: false,
          reference: apiConversation.reference,
          model: apiConversation.model,
          name: newEmptyConversationName,
          id: `${ExpectedConstants.localFolderIdPath()}/${ModelsUtil.getDefaultAgent()!.reference}${ItemUtil.entityIdSeparator}${newEmptyConversationName}`,
          folderId: ExpectedConstants.localFolderIdPath(),
          prompt: apiConversation.prompt,
          temperature: apiConversation.temperature,
          status: UploadStatus.LOADED,
          isMessageStreaming: true,
          isNameChanged: true,
          bucket: ExpectedConstants.localBucket,
        };
        overlayBaseAssertion.assertValueMatchObject(
          JSON.parse(actualConversation) as OverlayConversation,
          expectedConversationModel,
        );
        await overlayDialog.closeButton.click();

        await overlayChatHeaderAssertion.assertHeaderTitle(
          newEmptyConversationName,
        );
        await overlayHeader.leftPanelToggle.click();
        await overlayConversationAssertion.assertEntityState(
          { name: newEmptyConversationName },
          'visible',
        );
      },
    );
  },
);

// Helper function to build expected conversation model
function buildExpectedConversationModel(
  apiConversation: Conversation,
  apiConversationFromList: BackendChatEntity | PublishedItem,
  conversationType: 'pinned' | 'shared' | 'organization',
) {
  const folderId = apiConversation.folderId;

  const baseModel = {
    model: apiConversation.model,
    name: apiConversation.name,
    isPlayback: apiConversation.playback?.isPlayback ?? false,
    isReplay: apiConversation.replay?.isReplay ?? false,
    id: apiConversation.id,
    folderId: folderId,
    prompt: apiConversation.prompt,
    temperature: apiConversation.temperature,
    replay: apiConversation.replay,
    messages: apiConversation.messages,
    selectedAddons: apiConversation.selectedAddons,
    status: UploadStatus.LOADED,
    isMessageStreaming: false,
    bucket: apiConversationFromList.bucket,
  };

  // Add type-specific properties
  switch (conversationType) {
    case 'pinned':
      return {
        ...baseModel,
        updatedAt: apiConversationFromList.updatedAt,
        parentPath: apiConversationFromList.parentPath,
        permissions: (apiConversationFromList as BackendChatEntity).permissions,
      };
    case 'shared':
      return {
        ...baseModel,
        updatedAt: apiConversation.updatedAt,
        sharedWithMe: true,
      };
    case 'organization':
      return {
        ...baseModel,
        updatedAt: apiConversationFromList.updatedAt,
        publicationInfo: {
          version: apiConversation.id.substring(
            apiConversation.id.lastIndexOf(ItemUtil.entityIdSeparator) +
              ItemUtil.entityIdSeparator.length,
          ),
        },
        publishedWithMe: true,
      };
    default:
      return baseModel;
  }
}

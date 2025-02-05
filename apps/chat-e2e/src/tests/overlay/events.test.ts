import { Conversation } from '@/chat/types/chat';
import { Publication } from '@/chat/types/publication';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  API,
  ExpectedConstants,
  FolderConversation,
  MockedChatApiResponseBodies,
  OverlaySandboxUrls,
  PseudoModel,
  Theme,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { SortingUtil } from '@/src/utils/sortingUtil';
import {
  ConversationInfo,
  CreateConversationResponse,
  GetConversationsResponse,
  GetMessagesResponse,
  OverlayConversation,
  PublishActions,
  SelectConversationResponse,
  UploadStatus,
} from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

const publicationsToUnpublish: Publication[] = [];

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
      'EPMRTC-4845',
      'EPMRTC-395',
      'EPMRTC-4850',
      'EPMRTC-4506',
      'EPMRTC-4853',
    );
    const firstRequestContent = 'Hello';
    const secondRequestContent = 'test';
    const systemPrompt = `End each word with string "!?!?!"`;
    let secondRequest: Conversation;
    const configuredModelId = 'stability.stable-diffusion-xl';

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
        const actualMessages =
          await overlayDialog.content.getElementInnerContent();
        const expectedItem = await overlayItemApiHelper.getItem(
          secondRequest.id,
        );
        const expectedMessages: GetMessagesResponse = {
          messages: expectedItem.messages,
        };
        expect
          .soft(JSON.parse(actualMessages) as GetMessagesResponse)
          .toStrictEqual(expectedMessages);
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
              lastActivityDate: newConversationData.response.updatedAt,
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
        await overlayConfiguration.setConfigurationButton.click();
        await overlayAssertion.assertOverlayTheme(overlayHomePage, Theme.light);
        await overlayBaseAssertion.assertElementText(
          overlayAgentInfo.agentName,
          ModelsUtil.getDefaultModel()!.name,
        );
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
        await overlayHeader.createNewConversation();
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
    setTestIds('EPMRTC-396', 'EPMRTC-4852');
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
          .withConversationResource(publishedConversation, PublishActions.ADD)
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
        publicationsToUnpublish.push(publication);
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

        //build expected conversations published with user
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/2929
        // const actualPublishedConversationsList =
        //   await overlayPublicationApiHelper.listPublishedConversations();
        // for (const actualPublishedConversation of actualPublishedConversationsList.items!) {
        //   const conversation =
        //     await overlayPublicationApiHelper.getPublishedConversation(
        //       actualPublishedConversation.url,
        //     );
        //   const isPlayback = conversation.playback?.isPlayback;
        //   const isReplay = conversation.replay?.isReplay;
        //   const parentPath = actualPublishedConversation.parentPath;
        //   expectedConversationsArray.push({
        //     model: isPlayback
        //       ? { id: PseudoModel.playback }
        //       : isReplay
        //         ? { id: PseudoModel.replay }
        //         : conversation.model,
        //     name: conversation.name,
        //     isPlayback: isPlayback ?? false,
        //     isReplay: isReplay ?? false,
        //     publicationInfo: {
        //       version: actualPublishedConversation.name.substring(
        //         actualPublishedConversation.name.lastIndexOf(
        //           ItemUtil.conversationIdSeparator,
        //         ) + ItemUtil.conversationIdSeparator.length,
        //       ),
        //     },
        //     id: conversation.id,
        //     folderId: conversation.folderId,
        //     publishedWithMe: !parentPath,
        //     lastActivityDate: actualPublishedConversation.updatedAt,
        //     bucket: actualPublishedConversation.bucket,
        //     ...(parentPath && { parentPath }),
        //   });
        // }

        //build expected conversations created by user
        let actualConversationsList = await overlayItemApiHelper.listItems(
          API.conversationsHost(),
        );
        //need to sort conversations by 'lastActivityDate' and 'name' in order to define the last conversation
        actualConversationsList =
          SortingUtil.sortBackendConversationsByDateAndName(
            actualConversationsList,
          );
        for (let i = 0; i < actualConversationsList.length; i++) {
          let expectedConversation: OverlayConversation | Conversation;
          const conversation = await overlayItemApiHelper.getItem(
            actualConversationsList[i].url,
          );
          const actualConversation = actualConversationsList[i];
          const parentPath = actualConversation.parentPath;
          const isPlayback = conversation.playback?.isPlayback;
          const isReplay = conversation.replay?.isReplay;
          const shortConversation: ConversationInfo = {
            model: isPlayback
              ? { id: PseudoModel.playback }
              : isReplay
                ? { id: PseudoModel.replay }
                : conversation.model,
            name: conversation.name,
            isPlayback: isPlayback ?? false,
            isReplay: isReplay ?? false,
            id: conversation.id,
            lastActivityDate: actualConversation.updatedAt,
            folderId: conversation.folderId,
          };

          //save expectedSelectedConversation for the next test step if it is not last listed one
          if (shortConversation.id === todayConversation.id) {
            expectedSelectedConversation = {
              conversation: shortConversation as OverlayConversation,
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
              selectedAddons: conversation.selectedAddons,
              status: UploadStatus.LOADED,
              isMessageStreaming: false,
            };
            expectedConversation = {
              ...fullConversation,
              bucket: actualConversation.bucket,
              ...(parentPath && { parentPath }),
            };

            //save expectedSelectedConversation for the next test step if it is the last listed one
            if (expectedConversation.id === todayConversation.id) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { bucket, parentPath, ...conversationInfo } =
                expectedConversation;
              expectedSelectedConversation = {
                conversation: conversationInfo as OverlayConversation,
              };
            }
          } else {
            expectedConversation = {
              ...shortConversation,
              bucket: actualConversation.bucket,
              ...(parentPath && { parentPath }),
            };
          }
          expectedConversationsArray.push(expectedConversation);
        }

        //build expected conversations shared with user
        const actualSharedConversationsList =
          await overlayShareApiHelper.listSharedWithMeConversations();
        for (const actualSharedConversation of actualSharedConversationsList.resources) {
          const conversation = await overlayItemApiHelper.getItem(
            actualSharedConversation.url,
          );
          const isPlayback = conversation.playback?.isPlayback;
          const isReplay = conversation.replay?.isReplay;
          expectedConversationsArray.push({
            model: isPlayback
              ? { id: PseudoModel.playback }
              : isReplay
                ? { id: PseudoModel.replay }
                : conversation.model,
            name: conversation.name,
            isPlayback: isPlayback ?? false,
            isReplay: isReplay ?? false,
            id: conversation.id,
            folderId: conversation.folderId,
            sharedWithMe: true,
            bucket: actualSharedConversation.bucket,
          });
        }

        //compare conversations from bucket storage
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/2929
        // expect(actualConversationsModels.conversations.length).toBe(
        //   expectedConversationsModel.conversations.length + 1,
        // );
        expect(actualConversationsModels.conversations).toEqual(
          expect.arrayContaining(expectedConversationsModel.conversations),
        );

        //check newly created 'New conversation 1' is displayed
        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        actualConversationsModels.conversations.find(
          (c) => c.id === selectedConversationIds[0],
        );
        expect(
          actualConversationsModels.conversations.find(
            (c) => c.id === selectedConversationIds[0],
          ),
        ).toBeDefined();
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
        expect
          .soft(actualConversationModel)
          .toStrictEqual(expectedSelectedConversation.conversation);
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

dialOverlayTest.afterAll(
  async ({ overlayPublicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await overlayPublicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);

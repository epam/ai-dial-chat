import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

let defaultModel: DialAIEntityModel;
dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest.only(
  'Message template: Show more/less, Original message, tips.\n' +
    'Message template: new row appears if to type anything in "a part of the message" when \'your template\' is empty (and vice versa).\n' +
    'Message template: the changes are not saved if to close the window on X.\n' +
    'Message template: Delete is not available for the initial row, other rows can be deleted.\n' +
    'Message template: the window is not closed if to click on any area outside the window.\n' +
    "Message template: the order of the 'part of the messages' is set by user, no auto-sorting",
  async ({
    dialHomePage,
    conversations,
    messageTemplateModal,
    page,
    messageTemplateModalAssertion,
    chatMessages,
    conversationData,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-4251',
      'EPMRTC-4271',
      'EPMRTC-4268',
      'EPMRTC-4272',
      'EPMRTC-4269',
      'EPMRTC-4274',
    );
    const requestContent = GeneratorUtil.randomString(40)
      .concat(' ')
      .repeat(10);
    const truncatedRequestContent = requestContent
      .substring(0, 160)
      .concat('...');
    let conversation: Conversation;

    await dialTest.step('Prepare conversation with long request', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [requestContent],
      );
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Open "Message Template" modal and verify its content',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openMessageTemplateModal(1);
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.title,
          ExpectedConstants.messageTemplateModalTitle,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.description,
          ExpectedConstants.messageTemplateModalDescription,
        );
        await messageTemplateModalAssertion.assertElementAttribute(
          messageTemplateModal.templateRowContent(1),
          Attributes.placeholder,
          ExpectedConstants.messageTemplateContentPlaceholder,
        );
        await messageTemplateModalAssertion.assertElementAttribute(
          messageTemplateModal.getTemplateRowValue(1),
          Attributes.placeholder,
          ExpectedConstants.messageTemplateValuePlaceholder,
        );
      },
    );

    await dialTest.step(
      'Verify original message is cut with dots',
      async () => {
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.originalMessageContent,
          truncatedRequestContent,
        );
      },
    );

    await dialTest.step(
      'Click on "Show more" button and verify full message is displayed',
      async () => {
        await messageTemplateModal.showMoreButton.click();
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.originalMessageContent,
          requestContent,
        );
        await messageTemplateModal.showLessButton.click();
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.originalMessageContent,
          truncatedRequestContent,
        );
      },
    );

    await dialTest.step(
      'Set cursor in the first row and verify no new row is added',
      async () => {
        await messageTemplateModal.templateRowContent(1).click();
        await messageTemplateModalAssertion.assertElementsCount(
          messageTemplateModal.templateRows,
          1,
        );
      },
    );

    await dialTest.step(
      'Type request chars in the first row and verify new row is added, delete button is available for the first row',
      async () => {
        await messageTemplateModal
          .templateRowContent(1)
          .fill(requestContent.substring(0, 3));
        await messageTemplateModalAssertion.assertElementsCount(
          messageTemplateModal.templateRows,
          2,
        );
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getTemplateRowDeleteButton(1),
          'visible',
        );
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getTemplateRowDeleteButton(2),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Close the modal, reopen it again and verify changes are not saved',
      async () => {
        await messageTemplateModal.cancelButton.click();
        await chatMessages.openMessageTemplateModal(1);
        await messageTemplateModalAssertion.assertElementsCount(
          messageTemplateModal.templateRows,
          1,
        );
      },
    );

    await dialTest.step(
      'Click outside the modal and verify it is not closed',
      async () => {
        await page.mouse.click(0, 0);
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Type request chars in the first row and verify new row is added, delete button is available for the first row',
      async () => {
        const matchContent = requestContent.split(' ')[0].split('');
        const values = [
          GeneratorUtil.randomArrayElement(matchContent),
          GeneratorUtil.randomArrayElement(matchContent),
          GeneratorUtil.randomArrayElement(matchContent),
        ];
        for (let i = 0; i < values.length; i++) {
          await messageTemplateModal.templateRowContent(i + 1).fill(values[i]);
          await messageTemplateModal
            .getTemplateRowValue(i + 1)
            .fill(`{{${values[i]}}}`);
        }
        await messageTemplateModal.saveChanges();
        await chatMessages.openMessageTemplateModal(1);

        for (let i = 0; i < values.length; i++) {
          await messageTemplateModalAssertion.assertElementText(
            messageTemplateModal.templateRowContent(i + 1),
            values[i],
          );
        }
      },
    );
  },
);

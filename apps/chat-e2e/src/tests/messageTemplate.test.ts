import { Conversation } from '@/chat/types/chat';
import { Prompt } from '@/chat/types/prompt';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const varBracketsRegex = /\{\{|\}\}/g;
const firstVarValue = 'Spanish';
const secondVarValue = '2nd';
const thirdVarValue = 'Spain';
const fourthVarValue = 'national';
const requestContent =
  `${firstVarValue} is the ${secondVarValue} most widely spoken language in the world.\n` +
  `${firstVarValue} has a royal family.\n` +
  `${firstVarValue} people do not consider paella as ${thirdVarValue}’s ${fourthVarValue} dish.`;
const firstRowFirstVar = '{{Language}}';
const firstRowSecondVar = '{{number of place}}';
const secondRowFirstVar = '{{Country}}';
const secondRowSecondVar = '{{adjective}}';
const thirdRowFirstVar = '{{Language2}}';
const firstRowContent = 'Spanish is the 2nd';
const firstRowTemplate = `${firstRowFirstVar} is the ${firstRowSecondVar}`;
const secondRowContent = 'Spain’s national dish';
const secondRowTemplate = `${secondRowFirstVar}’s ${secondRowSecondVar} dish`;
const thirdRowContent = 'Spanish';
const thirdRowTemplate = thirdRowFirstVar;
const expectedPreviewContent = `${firstRowFirstVar} is the ${firstRowSecondVar} most widely spoken language in the world.\n${thirdRowFirstVar} has a royal family.\n${thirdRowFirstVar} people do not consider paella as ${secondRowFirstVar}’s ${secondRowSecondVar} dish.`;
const rowsMap = new Map([
  [firstRowContent, firstRowTemplate],
  [secondRowContent, secondRowTemplate],
  [thirdRowContent, thirdRowTemplate],
]);
const publicationsToUnpublish: Publication[] = [];

dialTest(
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
      conversation = conversationData.prepareModelConversationBasedOnRequests([
        requestContent,
      ]);
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
          messageTemplateModal.getTemplateRowContent(1),
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
        await messageTemplateModal.getTemplateRowContent(1).click();
        await messageTemplateModal.getTemplateRowValue(1).click();
        await messageTemplateModalAssertion.assertElementsCount(
          messageTemplateModal.templateRows,
          1,
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
          await messageTemplateModal
            .getTemplateRowContent(i + 1)
            .fill(values[i]);
          await messageTemplateModalAssertion.assertElementsCount(
            messageTemplateModal.templateRows,
            i + 2,
          );
          await messageTemplateModalAssertion.assertElementState(
            messageTemplateModal.getTemplateRowDeleteButton(i + 1),
            'visible',
          );
          await messageTemplateModalAssertion.assertElementState(
            messageTemplateModal.getTemplateRowDeleteButton(i + 2),
            'hidden',
          );
          await messageTemplateModal
            .getTemplateRowValue(i + 1)
            .fill(`{{${values[i]}}}`);
        }
        await messageTemplateModal.saveChanges();
        await chatMessages.openMessageTemplateModal(1);

        for (let i = 0; i < values.length; i++) {
          await messageTemplateModalAssertion.assertElementText(
            messageTemplateModal.getTemplateRowContent(i + 1),
            values[i],
          );
        }
      },
    );
  },
);

dialTest(
  'Message template: Preview mode based on three variables.\n' +
    'Message template: changes are saved: add a row, delete the row, update values',
  async ({
    dialHomePage,
    conversations,
    messageTemplateModal,
    messageTemplateModalAssertion,
    chatMessages,
    conversationData,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4270', 'EPMRTC-4276');
    const updatedSecondRowContent = secondRowContent.substring(0, 3);
    const updatedSecondRowTemplate = `{{${secondRowContent.substring(0, 3)}}}`;
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation with specified request',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          [requestContent],
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open "Message Template" modal and fill in rows with values',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openMessageTemplateModal(1);
        for (const [key, value] of rowsMap.entries()) {
          const index = Array.from(rowsMap.keys()).indexOf(key);
          await messageTemplateModal.getTemplateRowContent(index + 1).fill(key);
          await messageTemplateModal.getTemplateRowValue(index + 1).fill(value);
        }
      },
    );

    await dialTest.step(
      'Switch to Preview tab and verify the content',
      async () => {
        await messageTemplateModal.previewTab.click();
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.templatePreview,
          expectedPreviewContent,
        );
        for (const variable of [
          firstRowFirstVar,
          firstRowSecondVar,
          secondRowFirstVar,
          secondRowSecondVar,
          thirdRowFirstVar,
        ]) {
          await messageTemplateModalAssertion.assertElementAttribute(
            messageTemplateModal.templatePreviewVar(variable),
            Attributes.class,
            ThemeColorAttributes.textAccentTertiary,
          );
        }
      },
    );

    await dialTest.step(
      'Save changes, reopen "Message Template" modal and verify the changes are saved',
      async () => {
        await messageTemplateModal.saveChanges();
        await chatMessages.openMessageTemplateModal(1);
        await messageTemplateModalAssertion.assertElementsCount(
          messageTemplateModal.templateRows,
          rowsMap.size + 1,
        );
        for (const [key, value] of rowsMap.entries()) {
          const index = Array.from(rowsMap.keys()).indexOf(key);
          await messageTemplateModalAssertion.assertElementText(
            messageTemplateModal.getTemplateRowContent(index + 1),
            key,
          );
          await messageTemplateModalAssertion.assertElementText(
            messageTemplateModal.getTemplateRowValue(index + 1),
            value,
          );
        }
      },
    );

    await dialTest.step(
      'Delete the first row, update the second one and save',
      async () => {
        await messageTemplateModal
          .getTemplateRowContent(2)
          .fill(updatedSecondRowContent);
        await messageTemplateModal
          .getTemplateRowValue(2)
          .fill(updatedSecondRowTemplate);
        await messageTemplateModal.getTemplateRowDeleteButton(1).click();
        await messageTemplateModal.saveChanges();
      },
    );

    await dialTest.step(
      'Reopen "Message Template" modal and verify the changes are saved',
      async () => {
        await chatMessages.openMessageTemplateModal(1);
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowContent(1),
          updatedSecondRowContent,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowValue(1),
          updatedSecondRowTemplate,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowContent(2),
          thirdRowContent,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowValue(2),
          thirdRowTemplate,
        );
      },
    );
  },
);

dialTest(
  'Message template: updated user-message influences on the template: original text is updated, deleted text is removed from the template',
  async ({
    dialHomePage,
    conversations,
    messageTemplateModal,
    messageTemplateModalAssertion,
    chatMessages,
    conversationData,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4273');
    const request = requestContent.split('\n').slice(0, 2).join('\n');
    const rowsMap = new Map([
      [firstRowContent, firstRowTemplate],
      [thirdRowContent, thirdRowTemplate],
    ]);
    const updatedRequest = GeneratorUtil.randomString(5).concat(
      request.split('\n')[1],
    );
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation with message template',
      async () => {
        conversation =
          conversationData.prepareConversationBasedOnMessageTemplate(
            request,
            rowsMap,
          );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Edit conversation request by removing the first line',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chatMessages.editMessage(request, updatedRequest);
      },
    );

    await dialTest.step(
      'Open "Message Template" modal and verify template rows are updated',
      async () => {
        await chatMessages.openMessageTemplateModal(1);
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.originalMessageContent,
          updatedRequest,
        );
        await messageTemplateModalAssertion.assertElementsCount(
          messageTemplateModal.templateRows,
          2,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowContent(1),
          thirdRowContent,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowValue(1),
          thirdRowTemplate,
        );
      },
    );

    await dialTest.step(
      'Open template preview and verify it is updated according to changes',
      async () => {
        await messageTemplateModal.previewTab.click();
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.templatePreview,
          updatedRequest.replace(thirdRowContent, thirdRowFirstVar),
        );
      },
    );
  },
);

dialTest(
  'Message template: error "This part was not found in the original message" disappears if to correct the message after it was copy-pasted.\n' +
    'Message template: error "This part was not found in the original message".\n' +
    'Message template: error "Template must have at least one variable".\n' +
    'Message template: Preview and Save buttons are disabled if there is any error.\n' +
    'Message template: error "Please fill in this required field".\n' +
    `Message template: fill in 'template' field when 'a part of the message' is empty` +
    `Message template: error "Template doesn't match the message text".\n` +
    'Message template: errors are not applied to other fields from the row below, when the row is deleted',
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
      'EPMRTC-4297',
      'EPMRTC-4260',
      'EPMRTC-4262',
      'EPMRTC-4304',
      'EPMRTC-4264',
      'EPMRTC-4265',
      'EPMRTC-4263',
      'EPMRTC-4266',
    );
    const request = requestContent.split('\n')[0];
    const mismatchWord = 'food';
    const firstRowMismatchContent = `Spanish is the 2nd most widely spoken ${mismatchWord}`;
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation with specified request',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          [request],
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open "Message Template" modal, paste the text that does not match the request and verify error appears',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openMessageTemplateModal(1);
        await messageTemplateModal.getTemplateRowContent(1).click();
        await dialHomePage.copyToClipboard(firstRowMismatchContent);
        await dialHomePage.pasteFromClipboard();
        for (let i = 1; i <= 2; i++) {
          await page.keyboard.press(keys.backspace);
        }
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          ExpectedConstants.originalMessageTemplateErrorMessage,
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.saveTemplate,
          'disabled',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.previewTab,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Correct the text to match the request and verify error disappears',
      async () => {
        for (let i = 1; i <= mismatchWord.length; i++) {
          await page.keyboard.press(keys.backspace);
        }
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          'hidden',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.saveTemplate,
          'disabled',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.previewTab,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Type the text that match the request but in capitals and verify error appears',
      async () => {
        await messageTemplateModal
          .getTemplateRowContent(1)
          .fill(request.toUpperCase());
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          ExpectedConstants.originalMessageTemplateErrorMessage,
        );
      },
    );

    await dialTest.step(
      'Type incorrect value into template field and verify error appears',
      async () => {
        for (const variable of [GeneratorUtil.randomString(5), '{{}}']) {
          await messageTemplateModal.getTemplateRowValue(1).fill(variable);
          await messageTemplateModalAssertion.assertElementText(
            messageTemplateModal.getFieldBottomMessage(
              messageTemplateModal.getTemplateRowValue(1),
            ),
            ExpectedConstants.messageTemplateMissingVarErrorMessage,
          );
        }
      },
    );

    await dialTest.step(
      'Set correct value into template field and verify error disappears',
      async () => {
        await messageTemplateModal
          .getTemplateRowValue(1)
          .fill(secondRowFirstVar);
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowValue(1),
          ),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Delete the row and verify Save and Preview buttons are enabled',
      async () => {
        await messageTemplateModal.getTemplateRowDeleteButton(1).click();
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.saveTemplate,
          'enabled',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.previewTab,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Set the correct value in the template field and verify error is displayed',
      async () => {
        await messageTemplateModal
          .getTemplateRowValue(1)
          .fill(firstRowFirstVar);
        await messageTemplateModal.getTemplateRowContent(1).click();
        await messageTemplateModal.getTemplateRowValue(1).click();
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          ExpectedConstants.messageTemplateRequiredField,
        );
      },
    );

    await dialTest.step(
      'Set correct value into message, clear the row fields and verify error appears',
      async () => {
        await messageTemplateModal.getTemplateRowContent(1).fill(request);

        await messageTemplateModal.getTemplateRowContent(1).fill('');
        await messageTemplateModal.getTemplateRowValue(1).fill('');

        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          ExpectedConstants.messageTemplateRequiredField,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowValue(1),
          ),
          ExpectedConstants.messageTemplateRequiredField,
        );
      },
    );

    await dialTest.step(
      'Set correct values into row fields and verify errors disappear',
      async () => {
        await messageTemplateModal.getTemplateRowContent(1).fill(request);
        await messageTemplateModal
          .getTemplateRowValue(1)
          .fill(firstRowFirstVar);
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          'hidden',
        );
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowValue(1),
          ),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Set the template that does not match the message and verify error is displayed',
      async () => {
        await messageTemplateModal
          .getTemplateRowContent(1)
          .fill(firstRowContent);
        await messageTemplateModal
          .getTemplateRowValue(1)
          .fill(
            firstRowTemplate.substring(
              0,
              firstRowTemplate.indexOf(firstRowSecondVar),
            ),
          );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowValue(1),
          ),
          ExpectedConstants.messageTemplateMismatchTextErrorMessage,
        );
      },
    );

    await dialTest.step(
      'Correct the template value and verify error disappears',
      async () => {
        await messageTemplateModal
          .getTemplateRowValue(1)
          .fill(firstRowTemplate);
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          'hidden',
        );
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowValue(1),
          ),
          'hidden',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.saveTemplate,
          'enabled',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.previewTab,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Fill in one more row with the correct values, clear the 1st row and verify errors are displayed',
      async () => {
        await messageTemplateModal
          .getTemplateRowContent(2)
          .fill(thirdRowContent);
        await messageTemplateModal
          .getTemplateRowValue(2)
          .fill(thirdRowTemplate);

        await messageTemplateModal.getTemplateRowContent(1).fill('');
        await messageTemplateModal.getTemplateRowValue(1).fill('');
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          ExpectedConstants.messageTemplateRequiredField,
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowValue(1),
          ),
          ExpectedConstants.messageTemplateRequiredField,
        );
      },
    );

    await dialTest.step(
      'Delete row with errors and verify no errors are displayed for the valid row',
      async () => {
        await messageTemplateModal.getTemplateRowDeleteButton(1).click();
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowContent(1),
          ),
          'hidden',
        );
        await messageTemplateModalAssertion.assertElementState(
          messageTemplateModal.getFieldBottomMessage(
            messageTemplateModal.getTemplateRowValue(1),
          ),
          'hidden',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.saveTemplate,
          'enabled',
        );
        await messageTemplateModalAssertion.assertElementActionabilityState(
          messageTemplateModal.previewTab,
          'enabled',
        );
      },
    );
  },
);

dialTest(
  'Message template created for the user-message with parametrized prompt.\n' +
    'Replay with Message template created for the user-message with parametrized prompt',
  async ({
    dialHomePage,
    messageTemplateModal,
    messageTemplateModalAssertion,
    chatMessages,
    conversations,
    conversationDropdownMenu,
    chat,
    promptData,
    sendMessage,
    dataInjector,
    variableModalDialog,
    variableModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4298', 'EPMRTC-4372');
    const aVar = 'A';
    const aVarPlaceholder = `{{${aVar}}}`;
    const aValue = '1';
    const bVar = 'B';
    const bVarPlaceholder = `{{${bVar}}}`;
    const bValue = '2';
    const cVar = 'C';
    const cValue = '10';
    const cVarPlaceholder = `{{${cVar}|${cValue}}}`;
    const dVar = 'D';
    const dValue = '5';
    const dVarPlaceholder = `{{${dVar}|${dValue}}}`;
    const firstPromptContent = (a: string, b: string) =>
      `Calculate ${aVar} + ${bVar}, where ${aVar} = ${a} and ${bVar} = ${b}`;
    const secondPromptContent = (c: string, d: string) =>
      `Calculate ${cVar} - ${dVar}, where ${cVar} = ${c} and ${dVar} = ${d}`;
    const fullRequest = `${firstPromptContent(aValue, bValue)} AND ${secondPromptContent(cValue, dValue)}`;
    const conversationName = fullRequest.replace(
      new RegExp(`[${ExpectedConstants.restrictedNameChars}]`, 'g'),
      ' ',
    );
    let firstPrompt: Prompt;
    let secondPrompt: Prompt;

    await dialTest.step(
      'Prepare prompt with params and default values',
      async () => {
        firstPrompt = promptData.preparePrompt(
          firstPromptContent(aVarPlaceholder, bVarPlaceholder),
        );
        promptData.resetData();
        secondPrompt = promptData.preparePrompt(
          secondPromptContent(cVarPlaceholder, dVarPlaceholder),
        );
        await dataInjector.createPrompts([firstPrompt, secondPrompt]);
      },
    );

    await dialTest.step(
      'Create new conversation based on both prompts',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.messageInput.fillInInput(`/${firstPrompt.name}`);
        await sendMessage
          .getPromptList()
          .selectPromptWithMouse(firstPrompt.name, {
            triggeredHttpMethod: 'GET',
          });
        await variableModalDialog.setVariableValue(aVar, aValue);
        await variableModalDialog.setVariableValue(bVar, bValue);
        await variableModalDialog.submitButton.click();
        await sendMessage.typeInInput(' AND ');
        await sendMessage.messageInput.typeInInput(`/${secondPrompt.name}`);
        await sendMessage
          .getPromptList()
          .selectPromptWithMouse(secondPrompt.name, {
            triggeredHttpMethod: 'GET',
          });
        await variableModalDialog.submitButton.click();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.sendMessageButton.click();
      },
    );

    await dialTest.step(
      'Open request message template and verify prompts are displayed in the rows',
      async () => {
        await chatMessages.openMessageTemplateModal(1);
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.originalMessageContent,
          fullRequest,
        );

        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowContent(1),
          firstPromptContent(aValue, bValue),
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowContent(2),
          secondPromptContent(cValue, dValue),
        );

        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowValue(1),
          firstPromptContent(aVarPlaceholder, bVarPlaceholder),
        );
        await messageTemplateModalAssertion.assertElementText(
          messageTemplateModal.getTemplateRowValue(2),
          secondPromptContent(cVarPlaceholder, dVarPlaceholder),
        );
        await messageTemplateModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Create replay conversation based on current, start replaying and verify prompt variable modal is displayed',
      async () => {
        await conversations.openEntityDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
        await chat.replay.click();
        await variableModalAssertion.assertElementState(
          variableModalDialog,
          'visible',
        );
        await variableModalAssertion.assertPromptDescription(
          `${firstPromptContent(aVarPlaceholder, bVarPlaceholder)} AND ${secondPromptContent(cVarPlaceholder, dVarPlaceholder)}`,
        );
        for (const variable of [
          aVarPlaceholder,
          bVarPlaceholder,
          cVarPlaceholder,
          dVarPlaceholder,
        ]) {
          await variableModalAssertion.assertElementAttribute(
            variableModalDialog.descriptionVar(variable),
            Attributes.class,
            ThemeColorAttributes.textAccentTertiary,
          );
        }
      },
    );
  },
);

dialTest(
  'Replay with Message template: by the owner.\n' +
    'Replay with Message template: export-import.\n' +
    'Replay with Message template: duplicated chat',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chatBar,
    confirmationDialog,
    conversationAssertion,
    chat,
    conversationData,
    dataInjector,
    variableModalDialog,
    variableModalAssertion,
    apiAssertion,
    toast,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4277', 'EPMRTC-4283', 'EPMRTC-4287');
    let simpleConversationMessage: Conversation;
    let templateConversationMessage: Conversation;
    let conversation: Conversation;
    const firstUpdatedValue = GeneratorUtil.randomString(5);
    const secondUpdatedValue = GeneratorUtil.randomString(5);
    let replayName: string;

    await dialTest.step(
      'Prepare conversation with 2 requests where one of them is based on message template',
      async () => {
        simpleConversationMessage =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();
        templateConversationMessage =
          conversationData.prepareConversationBasedOnMessageTemplate(
            requestContent,
            rowsMap,
          );
        conversation = conversationData.prepareHistoryConversation(
          simpleConversationMessage,
          templateConversationMessage,
        );
        await dataInjector.createConversations([conversation]);
        replayName = `${ExpectedConstants.replayConversation}${conversation.name}`;
      },
    );

    await dialTest.step(
      'Export and then import created conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        const exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withoutAttachments,
          ),
        );
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await toast.closeToast();
        await conversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Create replay conversation based on imported',
      async () => {
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
      },
    );

    await dialTest.step(
      'Duplicate the replay conversation, start replaying and verify modal variable is displayed for the second conversation request',
      async () => {
        await conversations.openEntityDropdownMenu(replayName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.duplicate, {
          triggeredHttpMethod: 'POST',
        });
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.startReplay(
          simpleConversationMessage.messages[0].content,
          true,
        );
        await variableModalAssertion.assertElementState(
          variableModalDialog,
          'visible',
        );
        await variableModalAssertion.assertPromptDescription(
          expectedPreviewContent,
        );
        await variableModalDialog.closeButton.click();
      },
    );

    await dialTest.step(
      'Start replaying the main conversation and verify modal variable is displayed for the second conversation request',
      async () => {
        await conversations.selectConversation(
          replayName,
          { isHttpMethodTriggered: false },
          {
            exactMatch: true,
          },
        );
        await chat.startReplay(
          simpleConversationMessage.messages[0].content,
          true,
        );
        await variableModalAssertion.assertElementState(
          variableModalDialog,
          'visible',
        );
        await variableModalAssertion.assertPromptDescription(
          expectedPreviewContent,
        );
        for (const variable of [
          firstRowFirstVar,
          firstRowSecondVar,
          thirdRowFirstVar,
          secondRowFirstVar,
          secondRowSecondVar,
        ]) {
          await variableModalAssertion.assertElementAttribute(
            variableModalDialog.descriptionVar(variable),
            Attributes.class,
            ThemeColorAttributes.textAccentTertiary,
          );
        }
        await variableModalAssertion.assertPromptVariableValue(
          firstRowFirstVar.replaceAll(varBracketsRegex, ''),
          firstVarValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          firstRowSecondVar.replaceAll(varBracketsRegex, ''),
          secondVarValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          thirdRowFirstVar.replaceAll(varBracketsRegex, ''),
          firstVarValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          secondRowFirstVar.replaceAll(varBracketsRegex, ''),
          thirdVarValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          secondRowSecondVar.replaceAll(varBracketsRegex, ''),
          fourthVarValue,
        );
      },
    );

    await dialTest.step(
      'Update values for some fields, submit and verify updated values are applied',
      async () => {
        await variableModalDialog.setVariableValue(
          secondRowFirstVar.replaceAll(varBracketsRegex, ''),
          firstUpdatedValue,
        );
        await variableModalDialog.setVariableValue(
          secondRowSecondVar.replaceAll(varBracketsRegex, ''),
          secondUpdatedValue,
        );
        const request = await variableModalDialog.submitReplayVariables();
        await apiAssertion.assertRequestMessage(
          request.messages[2],
          requestContent
            .replaceAll(thirdVarValue, firstUpdatedValue)
            .replaceAll(fourthVarValue, secondUpdatedValue),
        );
      },
    );
  },
);

dialSharedWithMeTest(
  `Replay with Message template: by the user from 'Shared with me'`,
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserConversationDropdownMenu,
    additionalShareUserChat,
    additionalShareUserVariableModalDialog,
    additionalShareUserVariableModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4280');
    let simpleConversationMessage: Conversation;
    let templateConversationMessage: Conversation;
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation with 2 requests where one of them is based on message template',
      async () => {
        simpleConversationMessage =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();
        templateConversationMessage =
          conversationData.prepareConversationBasedOnMessageTemplate(
            requestContent,
            rowsMap,
          );
        conversation = conversationData.prepareHistoryConversation(
          simpleConversationMessage,
          templateConversationMessage,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step('Share it and accept the invite', async () => {
      const shareByLinkResponse =
        await mainUserShareApiHelper.shareEntityByLink([conversation]);
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialTest.step(
      'Create replay conversation for shared conversation and verify modal variable is displayed for the second conversation request on replaying',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMeConversations.selectConversation(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await additionalShareUserConversationDropdownMenu.selectMenuOption(
          MenuOptions.replay,
        );
        await additionalShareUserDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await additionalShareUserChat.startReplay(
          simpleConversationMessage.messages[0].content,
          true,
        );
        await additionalShareUserVariableModalAssertion.assertElementState(
          additionalShareUserVariableModalDialog,
          'visible',
        );
        await additionalShareUserVariableModalAssertion.assertPromptDescription(
          expectedPreviewContent,
        );
      },
    );
  },
);

dialAdminTest(
  `Replay with Message template: by the administrator from 'Approved required'.\n` +
    `Replay with Message template: by the user from 'Organization'`,
  async ({
    conversationData,
    dataInjector,
    publicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    dialHomePage,
    organizationConversations,
    conversationDropdownMenu,
    chat,
    variableModalDialog,
    variableModalAssertion,
    adminDialHomePage,
    adminChat,
    adminApproveRequiredConversations,
    adminApproveRequiredConversationDropdownMenu,
    adminVariableModal,
    adminVariableModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4281', 'EPMRTC-4282');
    let simpleConversationMessage: Conversation;
    let templateConversationMessage: Conversation;
    let conversation: Conversation;
    const publicationRequestName = GeneratorUtil.randomPublicationRequestName();
    let publication: Publication;

    await dialTest.step(
      'Prepare conversation with 2 requests where one of them is based on message template',
      async () => {
        simpleConversationMessage =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();
        templateConversationMessage =
          conversationData.prepareConversationBasedOnMessageTemplate(
            requestContent,
            rowsMap,
          );
        conversation = conversationData.prepareHistoryConversation(
          simpleConversationMessage,
          templateConversationMessage,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Create publication request for the conversation',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(publicationRequestName)
          .withConversationResource(conversation, PublishActions.ADD)
          .build();
        publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        publicationsToUnpublish.push(publication);
      },
    );

    await dialTest.step(
      'Create a replay conversation from "Approve required" section for publication request conversation',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          publicationRequestName,
        );
        await adminApproveRequiredConversations.openFolderEntityDropdownMenu(
          publicationRequestName,
          conversation.name,
        );
        await adminApproveRequiredConversationDropdownMenu.selectMenuOption(
          MenuOptions.replay,
        );
      },
    );

    await dialTest.step(
      'Start replaying and verify modal variable is displayed for the second conversation request',
      async () => {
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminChat.startReplay(
          simpleConversationMessage.messages[0].content,
          true,
        );
        await adminVariableModalAssertion.assertElementState(
          adminVariableModal,
          'visible',
        );
        await adminVariableModalAssertion.assertPromptDescription(
          expectedPreviewContent,
        );
      },
    );

    await dialTest.step('Approve publication request by admin', async () => {
      await adminPublicationApiHelper.approveRequest(publication);
    });

    await dialTest.step(
      'Create a replay conversation from "Organization" section for published conversation and verify modal variable is displayed for the second conversation request on replaying',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.startReplay(
          simpleConversationMessage.messages[0].content,
          true,
        );
        await variableModalAssertion.assertElementState(
          variableModalDialog,
          'visible',
        );
        await variableModalAssertion.assertPromptDescription(
          expectedPreviewContent,
        );
      },
    );
  },
);

dialTest.afterAll(
  async ({ publicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await publicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);

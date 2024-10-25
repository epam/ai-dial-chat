import { Conversation } from '@/chat/types/chat';
import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  ExpectedConstants,
  FolderPrompt,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  'The list of prompts is updated if to type /name.\n' +
    'Check how to close the prompt drop down list.\n' +
    'Prompt from the list is selected on mouse click.\n' +
    'Check long prompt name with spaces while calling prompts.\n' +
    'Check long prompt name without spaces while calling prompts',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    sendMessage,
    sendMessageAssertion,
    sendMessagePromptListAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-3843',
      'EPMRTC-3836',
      'EPMRTC-3834',
      'EPMRTC-1014',
      'EPMRTC-3812',
    );
    const prompts: Prompt[] = [];
    let promptToSelect: Prompt;
    const promptNames = [
      ExpectedConstants.newPromptTitle(1),
      ExpectedConstants.newPromptTitle(2),
      'The third Prompt',
    ];
    const searchTerm = '/the';

    await dialTest.step('Prepare 3 prompts', async () => {
      for (const name of promptNames) {
        prompts.push(
          promptData.preparePrompt(
            GeneratorUtil.randomString(10),
            undefined,
            name,
          ),
        );
        promptData.resetData();
      }
      await dataInjector.createPrompts(prompts);
    });

    await dialTest.step(
      `Type / in send message input and verify all prompts are shown, options have text-overflow=ellipsis css property`,
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        promptToSelect = prompts[1];
        await sendMessage.messageInput.fillInInput('/');
        await sendMessagePromptListAssertion.assertPromptListOptions(
          promptNames,
        );
        await sendMessagePromptListAssertion.assertPromptOptionOverflow(
          promptToSelect.name,
          Overflow.ellipsis,
        );
      },
    );

    await dialTest.step(`Remove / and verify dropdown is hidden`, async () => {
      await page.keyboard.press(keys.backspace);
      await sendMessagePromptListAssertion.assertPromptListState('hidden');
    });

    await dialTest.step(
      `Type "/the" in send message input and verify one prompt is shown`,
      async () => {
        await sendMessage.messageInput.fillInInput(searchTerm);
        const includedOptions = promptNames.filter((p) =>
          p.toLowerCase().includes(searchTerm.substring(1)),
        );
        const excludedOptions = promptNames.filter(
          (p) => !p.toLowerCase().includes(searchTerm.substring(1)),
        );
        await sendMessagePromptListAssertion.assertPromptListOptions(
          includedOptions,
          excludedOptions,
        );
      },
    );

    await dialTest.step(`Press ESC and verify dropdown is hidden`, async () => {
      await page.keyboard.press(keys.escape);
      await sendMessagePromptListAssertion.assertPromptListState('hidden');
    });

    await dialTest.step(
      `Type "/" in send message input click on prompt with mouse and verify it is applied in the field, dropdown list is closed`,
      async () => {
        await sendMessage.messageInput.fillInInput('/');
        await sendMessage
          .getPromptList()
          .selectPromptWithMouse(promptToSelect.name, {
            triggeredHttpMethod: 'GET',
          });
        await sendMessagePromptListAssertion.assertPromptListState('hidden');
        await sendMessageAssertion.assertMessageValue(promptToSelect.content!);
      },
    );
  },
);

dialTest(
  'Prompt text without parameters appears one by one in Input message box.\n' +
    'The text entered by user remains if to use prompt with parameters in Input message box',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    sendMessage,
    sendMessageAssertion,
    variableModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3823', 'EPMRTC-3803');
    let simplePrompt: Prompt;
    let promptWithVariable: Prompt;
    const promptVariable = 'A';
    const promptWithVariableContent = (variable: string) =>
      `Calculate ${variable} * 100`;

    await dialTest.step('Prepare 2 prompts', async () => {
      simplePrompt = promptData.preparePrompt(
        GeneratorUtil.randomString(10),
        undefined,
        ExpectedConstants.newPromptTitle(1),
      );
      promptData.resetData();
      promptWithVariable = promptData.preparePrompt(
        promptWithVariableContent(`{{${promptVariable}}}`),
        undefined,
        ExpectedConstants.newPromptTitle(2),
      );
      await dataInjector.createPrompts([simplePrompt, promptWithVariable]);
    });

    await dialTest.step(
      `Type / in send message input and select first prompt`,
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await sendMessage.messageInput.fillInInput('/');
        await sendMessage
          .getPromptList()
          .selectPromptWithKeyboard(simplePrompt.name, {
            triggeredHttpMethod: 'GET',
          });
      },
    );

    await dialTest.step(
      `Type / at the end of applied prompt, select second prompt and verify it is added after first prompt`,
      async () => {
        await sendMessage.messageInput.typeInInput('/');
        await sendMessage
          .getPromptList()
          .selectPromptWithKeyboard(promptWithVariable.name, {
            triggeredHttpMethod: 'GET',
          });
        const varValue = GeneratorUtil.randomIntegerNumber().toString();
        await variableModalDialog.setVariableValue(promptVariable, varValue);
        await variableModalDialog.submitButton.click();
        await sendMessageAssertion.assertMessageValue(
          simplePrompt.content + promptWithVariableContent(varValue),
        );
      },
    );
  },
);

dialTest(
  'Check prompt text contains line breaks as used in prompt body.\n' +
    "'/' sign and '/pro' are changed to the prompt text in input message",
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    sendMessage,
    sendMessageAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3844', 'EPMRTC-3838');
    let prompt: Prompt;
    const content =
      'Why do we use it?\n' +
      '\n' +
      "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).\n" +
      '\n' +
      'Where can I get some?\n';

    await dialTest.step(
      'Prepare a prompt with line breaks in the content',
      async () => {
        prompt = promptData.preparePrompt(content);
        await dataInjector.createPrompts([prompt]);
      },
    );

    await dialTest.step(
      `Type / in send message input, hit Enter and verify prompt content is displayed in the input`,
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        for (const searchTerm of ['/', `/${prompt.name.substring(0, 3)}`]) {
          await sendMessage.messageInput.fillInInput(searchTerm);
          await sendMessage
            .getPromptList()
            .selectPromptWithKeyboard(prompt.name, {
              triggeredHttpMethod: 'GET',
            });
          await sendMessageAssertion.assertMessageValue(content);
          await page.keyboard.press(keys.ctrlPlusA);
        }
      },
    );
  },
);

dialTest(
  'Check the window with prompt with parameters that have default values.\n' +
    'Check that parameters in prompt are required if to clear default values.\n' +
    'Error is shown if to enter space only as parameter value or set as default.\n' +
    'Updated default values are used in prompt text in Input message box',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    sendMessage,
    variableModalAssertion,
    variableModalDialog,
    sendMessageAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3829', 'EPMRTC-3830', 'EPMRTC-3842', 'EPMRTC-3832');
    let prompt: Prompt;
    const painterVar = 'Painter';
    const painterVarDefaultValue = 'Picasso';
    const painterVarUpdatedValue = 'Michelangelo';
    const adjectiveVar = 'is the Adjective';
    const adjectiveVarUpdatedValue = 'greatest';
    const nounVar = 'Noun';
    const nounVarDefaultValue = 'painter in the history';
    const nounVarUpdatedValue = 'sculptor';
    const promptTemplate = (painter: string, adjective: string, noun: string) =>
      `Do you agree that ${painter} is the ${adjective} ${noun}?`;
    const content = promptTemplate(
      `{{${painterVar}|${painterVarDefaultValue}}}`,
      `{{${adjectiveVar}}}`,
      `{{${nounVar}|${nounVarDefaultValue}}}`,
    );

    await dialTest.step(
      'Prepare a prompt with parametrized content',
      async () => {
        prompt = promptData.preparePrompt(content);
        await dataInjector.createPrompts([prompt]);
      },
    );

    await dialTest.step(
      `Type / in send message input, select created prompt and verify prompt edit window is opened`,
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await sendMessage.messageInput.fillInInput('/');
        await sendMessage
          .getPromptList()
          .selectPromptWithKeyboard(prompt.name, {
            triggeredHttpMethod: 'GET',
          });
        await variableModalAssertion.assertVariableModalState('visible');
      },
    );

    await dialTest.step(
      `Verify prompt params are available and filled with default data`,
      async () => {
        await variableModalAssertion.assertPromptVariableLabel(painterVar);
        await variableModalAssertion.assertPromptVariableLabelRequired(
          painterVar,
        );
        await variableModalAssertion.assertPromptVariableValue(
          painterVar,
          painterVarDefaultValue,
        );

        await variableModalAssertion.assertPromptVariableLabel(adjectiveVar);
        await variableModalAssertion.assertPromptVariableLabelRequired(
          adjectiveVar,
        );
        await variableModalAssertion.assertPromptVariableValue(
          adjectiveVar,
          '',
        );
        await variableModalAssertion.assertPromptVariablePlaceholder(
          adjectiveVar,
          ExpectedConstants.promptPlaceholder(adjectiveVar),
        );

        await variableModalAssertion.assertPromptVariableLabel(nounVar);
        await variableModalAssertion.assertPromptVariableLabelRequired(nounVar);
        await variableModalAssertion.assertPromptVariableValue(
          nounVar,
          nounVarDefaultValue,
        );
      },
    );

    await dialTest.step(
      'Click Submit button and verify second parameter is highlighted with red, error message is displayed under the field',
      async () => {
        await variableModalDialog.submitButton.click();
        await variableModalAssertion.assertPromptVariableBordersColor(
          adjectiveVar,
          Colors.textError,
        );
        await variableModalAssertion.assertPromptVariableBottomMessage(
          adjectiveVar,
          ExpectedConstants.fillVariablesAlertText,
        );
        await variableModalAssertion.assertPromptVariableBottomMessageColor(
          adjectiveVar,
          Colors.textError,
        );
      },
    );

    await dialTest.step(
      'Clear first variable field, set spaces in the third one and verify fields are highlighted with red, error messages are displayed under',
      async () => {
        for (const varLabel of [painterVar, nounVar]) {
          if (varLabel === painterVar) {
            await variableModalDialog.setVariableValue(varLabel, '');
          } else {
            await variableModalDialog.setVariableValue(varLabel, '   ');
            await variableModalDialog.submitButton.click();
          }

          await variableModalAssertion.assertPromptVariableBordersColor(
            varLabel,
            Colors.textError,
          );
          await variableModalAssertion.assertPromptVariableBottomMessage(
            varLabel,
            ExpectedConstants.fillVariablesAlertText,
          );
          await variableModalAssertion.assertPromptVariableBottomMessageColor(
            varLabel,
            Colors.textError,
          );
        }
      },
    );

    await dialTest.step(
      'Set all variable fields, click "Submit" button and verify prompt with entered variables is applied in the Send input',
      async () => {
        await variableModalDialog.setVariableValue(
          painterVar,
          painterVarUpdatedValue,
        );
        await variableModalDialog.setVariableValue(
          adjectiveVar,
          adjectiveVarUpdatedValue,
        );
        await variableModalDialog.setVariableValue(
          nounVar,
          nounVarUpdatedValue,
        );
        await variableModalDialog.submitButton.click();
        await sendMessageAssertion.assertMessageValue(
          promptTemplate(
            painterVarUpdatedValue,
            adjectiveVarUpdatedValue,
            nounVarUpdatedValue,
          ),
        );
      },
    );
  },
);

dialTest(
  'The first default value is used for the parameters with equal names.\n' +
    'Check long prompts name, description, parameter on the window with prompt that has parameters.\n' +
    'Tooltip for long prompts name appears on the window with prompt that has parameters',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    sendMessage,
    variableModalAssertion,
    tooltipAssertion,
    variableModalDialog,
    sendMessageAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3833', 'EPMRTC-1015', 'EPMRTC-3865');
    let prompt: Prompt;
    const promptName = 'testName'.repeat(20);
    const promptDescription = 'testDescription';
    const duplicateVarLabel = 'A';
    const promptContent = 'Calculate {{A|1}} + {{B|3}} - {{A|2}} + {{C|4}} =';
    const expectedAppliedPromptContent = 'Calculate 1 + 3 - 1 + 4 =';

    await dialTest.step(
      'Prepare a prompt with long name and duplicated vars',
      async () => {
        prompt = promptData.preparePrompt(
          promptContent,
          promptDescription,
          promptName,
        );
        await dataInjector.createPrompts([prompt]);
      },
    );

    await dialTest.step(
      `Type / in send message input, select created prompt and verify prompt name, description and variables have valid css properties`,
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await sendMessage.messageInput.fillInInput('/');
        await sendMessage
          .getPromptList()
          .selectPromptWithKeyboard(prompt.name, {
            triggeredHttpMethod: 'GET',
          });
        await variableModalAssertion.assertHorizontalScrollState('hidden');
        await variableModalAssertion.assertPromptNameStyle();
        await variableModalAssertion.assertPromptDescriptionStyle();
        await variableModalAssertion.assertPromptVariableLabelStyle(
          duplicateVarLabel,
        );
        await variableModalAssertion.assertPromptVariablePlaceholderStyle(
          duplicateVarLabel,
        );
      },
    );

    await dialTest.step(
      'Hover over prompt name and verify tooltip with full name is displayed',
      async () => {
        await variableModalDialog.name.hoverOver();
        await tooltipAssertion.assertTooltipContent(promptName);
        await tooltipAssertion.assertTooltipStyle(
          Styles.wordBreak,
          Styles.breakAll,
        );
      },
    );

    await dialTest.step(
      'Submit prompt and verify duplicated variable is not displayed',
      async () => {
        await variableModalDialog.submitButton.click();
        await sendMessageAssertion.assertMessageValue(
          expectedAppliedPromptContent,
        );
      },
    );
  },
);

dialTest(
  'Prompt with parameters appears in System prompt field in chat settings.\n' +
    'The chat is replayed without a Prompt pop-up if there is parameter in the prompt and prompt is used in System prompt',
  async ({
    dialHomePage,
    promptData,
    conversationData,
    dataInjector,
    entitySettings,
    variableModalAssertion,
    entitySettingAssertion,
    variableModalDialog,
    conversations,
    conversationDropdownMenu,
    chat,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3821', 'EPMRTC-3883');
    let prompt: Prompt;
    const aVar = 'a';
    const aVarValue = '5';
    const bVar = 'b';
    const bVarDefaultValue = '10';
    const promptTemplate = (a: string, b: string) => `Calculate ${a} + ${b}`;
    const promptContent = promptTemplate(
      `{{${aVar}}}`,
      `{{${bVar}|${bVarDefaultValue}}}`,
    );
    let conversation: Conversation;

    await dialTest.step(
      'Prepare prompt with vars and empty conversation',
      async () => {
        prompt = promptData.preparePrompt(promptContent);
        conversation = conversationData.prepareEmptyConversation();
        await dataInjector.createPrompts([prompt]);
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      `Type / in system prompt field, select created prompt and verify variable modal with default values is displayed`,
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await entitySettings.setSystemPrompt('/');
        const promptsList = entitySettings.getPromptList();
        await promptsList.selectPromptWithKeyboard(prompt.name, {
          triggeredHttpMethod: 'PUT',
        });
        await variableModalAssertion.assertVariableModalState('visible');
        await variableModalAssertion.assertPromptVariableValue(aVar, '');
        await variableModalAssertion.assertPromptVariableValue(
          bVar,
          bVarDefaultValue,
        );
      },
    );

    await dialTest.step(
      `Set prompt variables, submit and verify prompt is applied in the field`,
      async () => {
        await variableModalDialog.setVariableValue(aVar, aVarValue);
        await variableModalDialog.submitButton.click();
        await entitySettingAssertion.assertSystemPromptValue(
          promptTemplate(aVarValue, bVarDefaultValue),
        );
      },
    );

    await dialTest.step(
      `Send request and then create replay conversation`,
      async () => {
        const newName = 'test';
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithKeyboard(newName);
        await conversations.openEntityDropdownMenu(newName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });
      },
    );

    await dialTest.step(
      `Start replaying and verify no variable modal appears`,
      async () => {
        await chat.startReplay(undefined, true);
        await variableModalAssertion.assertVariableModalState('hidden');
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Use shared with me prompt in system prompt',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserEntitySettings,
    additionalShareUserVariableModalDialog,
    additionalShareUserChat,
    additionalShareUserSystemPromptListAssertion,
    additionalShareUserVariableModalAssertion,
    additionalShareUserEntitySettingAssertion,
    apiAssertion,
    setTestIds,
    setIssueIds,
  }) => {
    setTestIds('EPMRTC-3502');
    setIssueIds('1562');
    let folderPrompt: FolderPrompt;
    let promptWithParams: Prompt;
    let promptInFolder: Prompt;
    let sharePromptByLinkResponse: ShareByLinkResponseModel;
    let shareFolderByLinkResponse: ShareByLinkResponseModel;
    const promptTemplate = (param: string) => `Hi ${param}`;
    const promptParam = 'where';
    const promptParamValue = 'there';
    const promptContent = promptTemplate(`{{${promptParam}}}`);

    await dialSharedWithMeTest.step(
      'Prepare folder with prompt, prompt with parameters and share them',
      async () => {
        folderPrompt = promptData.prepareDefaultPromptInFolder();
        promptInFolder = folderPrompt.prompts[0];
        promptData.resetData();
        promptWithParams = promptData.preparePrompt(promptContent);
        await dataInjector.createPrompts(
          [promptWithParams, ...folderPrompt.prompts],
          folderPrompt.folders,
        );
        sharePromptByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([promptWithParams]);
        shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            folderPrompt.prompts,
            true,
          );
        await additionalUserShareApiHelper.acceptInvite(
          sharePromptByLinkResponse,
        );
        await additionalUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
      },
    );

    await dialTest.step(
      `Type / in system prompt field, select shared prompt with parameters and verify variable modal with default values is displayed`,
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserEntitySettings.setSystemPrompt('/');
        await additionalShareUserSystemPromptListAssertion.assertPromptListOptions(
          [promptWithParams.name, promptInFolder.name],
        );
        await additionalShareUserEntitySettings
          .getPromptList()
          .selectPromptWithKeyboard(promptWithParams.name, {
            triggeredHttpMethod: 'PUT',
          });
        await additionalShareUserVariableModalAssertion.assertVariableModalState(
          'visible',
        );
        await additionalShareUserVariableModalAssertion.assertPromptVariableValue(
          promptParam,
          '',
        );
        await additionalShareUserVariableModalDialog.setVariableValue(
          promptParam,
          promptParamValue,
        );
        await additionalShareUserVariableModalDialog.submitButton.click();
        await additionalShareUserEntitySettingAssertion.assertSystemPromptValue(
          promptTemplate(promptParamValue),
        );
      },
    );

    await dialTest.step(
      `Type / in system prompt field, select shared folder prompt and verify it is applied after the first prompt`,
      async () => {
        await additionalShareUserEntitySettings.setSystemPrompt('/');
        await additionalShareUserEntitySettings
          .getPromptList()
          .selectPromptWithKeyboard(promptInFolder.name, {
            triggeredHttpMethod: 'PUT',
          });
        await additionalShareUserEntitySettingAssertion.assertSystemPromptValue(
          promptTemplate(promptParamValue) + promptInFolder.content,
        );
      },
    );

    await dialTest.step(
      `Send request and verify system prompt is applied`,
      async () => {
        const request = await additionalShareUserChat.sendRequestWithKeyboard(
          'test',
          false,
        );
        await apiAssertion.assertRequestPrompt(
          request,
          promptTemplate(promptParamValue) + promptInFolder.content,
        );
      },
    );
  },
);

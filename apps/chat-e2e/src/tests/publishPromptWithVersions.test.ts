import dialTest from '@/src/core/dialFixtures';
import { ExpectedPromptModalConst, MenuOptions } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil, SortingUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Prompt, PublishActions } from '@epam/ai-dial-shared';

dialTest(
  'Published prompt versions are sorted in descending order.\n' +
    'View form. View selected prompt version.\n' +
    'View form for prompt from Organization section.\n' +
    'View form. Published prompt version is NOT saved if to set it on View form and close the form.\n' +
    'View form. Duplicate selected prompt version from View form.\n' +
    'Context menu. Duplicate prompt via context menu. The biggest version is duplicated.\n' +
    'Context menu. Duplicate prompt via context menu. The biggest version is duplicated.\n' +
    'View form. Unpublish. [Publication]: Add unpublish icon for View form of published prompts.\n' +
    'Context menu. Unpublish prompt via context menu',
  async ({
    promptData,
    dataInjector,
    localStorageManager,
    publicationApiHelper,
    dialHomePage,
    setTestIds,
    adminPublicationApiHelper,
    publishRequestBuilder,
    organizationPrompts,
    promptDropdownMenu,
    promptPreviewModal,
    promptPreviewVersionDropdownMenu,
    publishingRequestModal,
    promptDropdownMenuAssertion,
    promptPreviewModalAssertion,
    organizationPromptAssertion,
    promptAssertion,
    publishingRequestModalAssertion,
    promptToPublishAssertion,
    prompts,
  }) => {
    setTestIds(
      'EPMRTC-5892',
      'EPMRTC-5900',
      'EPMRTC-3219',
      'EPMRTC-5897',
      'EPMRTC-4437',
      'EPMRTC-6548',
      'EPMRTC-5896',
      'EPMRTC-5901',
      'EPMRTC-5902',
    );
    let prompt: Prompt;
    const sortedVersionsArray = SortingUtil.sortVersionsArray([
      GeneratorUtil.randomApplicationVersion(),
      GeneratorUtil.randomApplicationVersion(),
      GeneratorUtil.randomApplicationVersion(),
    ]);
    const promptVersionDataMap = new Map(
      sortedVersionsArray.map((version) => [
        version,
        {
          content: GeneratorUtil.randomString(7),
          description: GeneratorUtil.randomString(7),
        },
      ]),
    );

    await dialTest.step(
      'Publish three versions of prompt via API',
      async () => {
        //create init prompt
        prompt = promptData.preparePrompt(
          promptVersionDataMap.get(sortedVersionsArray[0])!.content,
          promptVersionDataMap.get(sortedVersionsArray[0])!.description,
        );
        await dataInjector.createPrompts([prompt]);

        for (let i = 0; i < promptVersionDataMap.size; i++) {
          if (i > 0) {
            //update 2nd and 3rd prompts via API
            prompt.content = promptVersionDataMap.get(
              sortedVersionsArray[i],
            )!.content;
            prompt.description = promptVersionDataMap.get(
              sortedVersionsArray[i],
            )!.description;
            await dataInjector.updatePrompts([prompt]);
          }
          //create prompt publishing request and approve it
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withPromptInFolderResource(
              prompt,
              PublishActions.ADD_IF_ABSENT,
              sortedVersionsArray[i],
            )
            .build();
          const publicationRequestModel =
            await publicationApiHelper.createPublishRequest(publishRequest);
          await adminPublicationApiHelper.approveRequest(
            publicationRequestModel,
          );
        }

        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open DIAL home page and verify only one prompt is displayed under "Organization" section',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationPromptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'View prompt via dropdown menu and verify prompt data corresponds the latest published version',
      async () => {
        await organizationPrompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.view, {
          triggeredHttpMethod: 'GET',
        });
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await promptPreviewModalAssertion.assertPromptPreviewModalTitle(
          ExpectedPromptModalConst.promptViewModalTitle,
        );
        await promptPreviewModalAssertion.assertPromptName(prompt.name);
        await promptPreviewModalAssertion.assertPromptContent(
          promptVersionDataMap.get(sortedVersionsArray[0])!.content,
        );
        await promptPreviewModalAssertion.assertPromptDescription(
          promptVersionDataMap.get(sortedVersionsArray[0])!.description,
        );
        await promptPreviewModalAssertion.assertPromptVersion(
          sortedVersionsArray[0],
        );
        for (const button of [
          promptPreviewModal.promptDuplicateButton,
          promptPreviewModal.promptExportButton,
          promptPreviewModal.promptUnpublishButton,
          promptPreviewModal.promptInfoButton,
          promptPreviewModal.usePromptButton,
        ]) {
          await promptPreviewModalAssertion.assertElementState(
            button,
            'visible',
          );
        }
        await promptPreviewModalAssertion.assertElementActionabilityState(
          promptPreviewModal.usePromptButton,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Expand versions dropdown menu and verify versions are sorted in descending order',
      async () => {
        await promptPreviewModal.version.click();
        await promptDropdownMenuAssertion.assertMenuOptions(
          sortedVersionsArray,
        );
      },
    );

    await dialTest.step(
      'Switch the version and verify prompt data corresponds selected version',
      async () => {
        await promptPreviewVersionDropdownMenu.selectMenuOption(
          sortedVersionsArray[2],
          {
            triggeredHttpMethod: 'GET',
          },
        );
        await promptPreviewModalAssertion.assertPromptName(prompt.name);
        await promptPreviewModalAssertion.assertPromptContent(
          promptVersionDataMap.get(sortedVersionsArray[2])!.content,
        );
        await promptPreviewModalAssertion.assertPromptDescription(
          promptVersionDataMap.get(sortedVersionsArray[2])!.description,
        );
        await promptPreviewModalAssertion.assertPromptVersion(
          sortedVersionsArray[2],
        );
      },
    );

    await dialTest.step(
      'Close the modal, open it again and verify the latest version is selected',
      async () => {
        await promptPreviewModal.closeButton.click();
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'hidden',
        );
        await organizationPrompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.view, {
          triggeredHttpMethod: 'GET',
        });
        await promptPreviewModalAssertion.assertPromptVersion(
          sortedVersionsArray[0],
        );
      },
    );

    await dialTest.step(
      'Switch the version, click on "Duplicate" btn and verify prompt with selected version is duplicated into "Recent" section',
      async () => {
        await promptPreviewModal.version.click();
        await promptPreviewVersionDropdownMenu.selectMenuOption(
          sortedVersionsArray[1],
          {
            triggeredHttpMethod: 'GET',
          },
        );
        await promptPreviewModal.duplicatePrompt();
        await promptPreviewModalAssertion.assertPromptName(`${prompt.name} 1`);
        await promptPreviewModalAssertion.assertPromptContent(
          promptVersionDataMap.get(sortedVersionsArray[1])!.content,
        );
        await promptPreviewModalAssertion.assertPromptDescription(
          promptVersionDataMap.get(sortedVersionsArray[1])!.description,
        );
        await promptPreviewModal.closeButton.click();
        await promptAssertion.assertEntityState(
          { name: `${prompt.name} 1` },
          'visible',
        );
      },
    );

    //TODO: remove the step when the issue is fixed: https://github.com/epam/ai-dial-chat/issues/2302
    await dialTest.step(
      'Open published prompt and set the version to the latest one',
      async () => {
        await organizationPrompts.selectEntity(prompt.name, {
          isHttpMethodTriggered: true,
        });
        await promptPreviewModal.version.click();
        await promptPreviewVersionDropdownMenu.selectMenuOption(
          sortedVersionsArray[0],
          {
            triggeredHttpMethod: 'GET',
          },
        );
        await promptPreviewModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Open published prompt dropdown menu, select "Duplicate" option and verify the latest prompt version is duplicated into "Recent" section',
      async () => {
        await organizationPrompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.duplicate, {
          triggeredHttpMethod: 'POST',
        });
        await promptAssertion.assertEntityState(
          { name: `${prompt.name} 2` },
          'visible',
        );
        await prompts.selectEntity(
          `${prompt.name} 2`,
          { isHttpMethodTriggered: true },
          { exactMatch: true },
        );
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await promptPreviewModalAssertion.assertPromptName(`${prompt.name} 2`);
        await promptPreviewModalAssertion.assertPromptContent(
          promptVersionDataMap.get(sortedVersionsArray[0])!.content,
        );
        await promptPreviewModalAssertion.assertPromptDescription(
          promptVersionDataMap.get(sortedVersionsArray[0])!.description,
        );
        await promptPreviewModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Select published prompt, switch the version, click on "Unpublish" btn and verify Unpublish modal is displayed, prompt version corresponds the selected one',
      async () => {
        await organizationPrompts.selectEntity(prompt.name, {
          isHttpMethodTriggered: true,
        });
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await promptPreviewModal.version.click();
        await promptPreviewVersionDropdownMenu.selectMenuOption(
          sortedVersionsArray[2],
          {
            triggeredHttpMethod: 'GET',
          },
        );
        await promptPreviewModal.promptUnpublishButton.click();
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await promptToPublishAssertion.assertEntityColor(
          { name: prompt.name },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
        );
        await promptToPublishAssertion.assertEntityVersion(
          { name: prompt.name },
          sortedVersionsArray[2],
        );
        await promptToPublishAssertion.assertEntityVersionColor(
          { name: prompt.name },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
        );
        await publishingRequestModal.cancelButton.click();
        await promptPreviewModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Open published prompt dropdown menu, select "Unpublish" option and verify Unpublish modal is displayed, prompt version corresponds set to the latest one',
      async () => {
        await organizationPrompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await promptToPublishAssertion.assertEntityColor(
          { name: prompt.name },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
        );
        await promptToPublishAssertion.assertEntityVersion(
          { name: prompt.name },
          sortedVersionsArray[0],
        );
        await promptToPublishAssertion.assertEntityVersionColor(
          { name: prompt.name },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
        );
      },
    );
  },
);

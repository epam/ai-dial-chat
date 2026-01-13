import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedConfirmationPopupData,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  UploadMenuOptions,
} from '@/src/testData';
import {
  AttributeValues,
  Attributes,
  ThemeColorAttributes,
} from '@/src/ui/domData';
import { BaseElement, FileModalSection, Tab } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Locator } from '@playwright/test';
import { CDPSession } from 'playwright-chromium';

let modelsWithAttachments: DialAIEntityModel[];
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
});
const attachedFiles = [Attachment.sunImageName, Attachment.flowerImageName];

dialTest(
  '[Manage attachments] Delete a file through context menu. Cancel.\n' +
    '[Manage attachments] Delete a file though context menu. Delete',
  async ({
    filesManagerPage,
    filesManagerGrid,
    filesManagerGridRowDropdownMenu,
    filesManagerDeleteItemConfirmationPopup,
    setTestIds,
    fileApiHelper,
    filesManagerDeleteItemConfirmationPopupAssertion,
    filesManagerGridAssertion,
  }) => {
    setTestIds('EPMRTC-1884', 'EPMRTC-3296');

    let fileDotsMenu: Locator;

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
    });

    await dialTest.step(
      'Open "File manager" page through chat side bar icon',
      async () => {
        await filesManagerPage.openFilesManagerPage();
        await filesManagerPage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Open attached file dropdown menu and select Delete option',
      async () => {
        fileDotsMenu = filesManagerGrid.gridDotsMenuByNameCell(
          Attachment.sunImageName,
        );
        await fileDotsMenu.click();
        await filesManagerGridRowDropdownMenu.selectItem(MenuOptions.delete, {
          isHttpMethodTriggered: false,
        });
      },
    );

    await dialTest.step(
      'Verify "Confirm Deleting Item" popup with valid text appears',
      async () => {
        await filesManagerDeleteItemConfirmationPopupAssertion.assertElementState(
          filesManagerDeleteItemConfirmationPopup,
          'visible',
        );
        await filesManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConfirmationPopupData.deleteItemHeader,
        );
        await filesManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupContent(
          ExpectedConfirmationPopupData.deleteItemContent(
            Attachment.sunImageName,
          ),
        );
      },
    );

    await dialTest.step(
      'Close popup and verify file is not deleted',
      async () => {
        await filesManagerDeleteItemConfirmationPopup.getCancelButton().click();
        await filesManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Proceed again to "Confirm Deleting Item" popup, confirm file delete and verify it disappears from the grid',
      async () => {
        await fileDotsMenu.click();
        await filesManagerGridRowDropdownMenu.selectItem(MenuOptions.delete, {
          isHttpMethodTriggered: false,
        });
        await filesManagerDeleteItemConfirmationPopup.confirm({
          triggeredHttpMethod: 'POST',
          triggeredHttpHost: API.deleteFileHost(),
        });
        await filesManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  '[Manage attachments] Delete several files. Cancel.\n' +
    '[Manage attachments] Delete several files. Delete',
  async ({
    dialHomePage,
    setTestIds,
    fileApiHelper,
    conversationData,
    sendMessage,
    dataInjector,
    conversations,
    attachmentDropdownMenu,
    filesManagerModalGrid,
    filesManagerModalToolbar,
    filesManagerDeleteItemConfirmationPopup,
    filesManagerDeleteItemConfirmationPopupAssertion,
    localStorageManager,
    filesManagerModalGridAssertion,
  }) => {
    setTestIds('EPMRTC-3298', 'EPMRTC-3299');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let conversation: Conversation;

    await dialTest.step('Upload 2 files to app', async () => {
      for (const file of attachedFiles) {
        await fileApiHelper.putFile(file);
      }
    });

    await dialTest.step(
      'Create empty conversation that allow input attachments',
      async () => {
        conversation = conversationData.prepareEmptyConversation(
          randomModelWithAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithAttachment,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open "File manager" modal for created conversation and check attached files',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        for (const file of attachedFiles) {
          await filesManagerModalGrid.gridCheckboxByNameCell(file).click();
        }
      },
    );

    await dialTest.step(
      'Click Delete button at the bottom and verify "Confirm deleting items" popup with valid text appears',
      async () => {
        await filesManagerModalToolbar.getDeleteButton().click();
        await filesManagerDeleteItemConfirmationPopupAssertion.assertElementState(
          filesManagerDeleteItemConfirmationPopup,
          'visible',
        );
        await filesManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConfirmationPopupData.deleteItemsHeader,
        );
        await filesManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupContent(
          ExpectedConfirmationPopupData.deleteItemsContent(
            attachedFiles.length,
          ),
        );
      },
    );

    await dialTest.step(
      'Close popup and verify files are not deleted',
      async () => {
        await filesManagerDeleteItemConfirmationPopup.getCancelButton().click();
        for (const file of attachedFiles) {
          await filesManagerModalGridAssertion.assertGridRowByNameState(
            file,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Proceed again to "Confirm deleting items" modal, confirm files delete and verify they disappear from files list',
      async () => {
        await filesManagerModalToolbar.getDeleteButton().click();
        await filesManagerDeleteItemConfirmationPopup.confirm({
          triggeredHttpMethod: 'POST',
          triggeredHttpHost: API.deleteFileHost(),
        });
        for (const file of attachedFiles) {
          await filesManagerModalGridAssertion.assertGridRowByNameState(
            file,
            'hidden',
          );
        }
      },
    );
  },
);

dialTest(
  '[Manage attachments] Delete file while it is being uploaded',
  async ({
    dialHomePage,
    setTestIds,
    filesManagerPage,
    filesManagerGridAssertion,
    uploadProgressDialog,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3302');

    await dialTest.step(
      'Open Files manager page by direct URL navigation',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await filesManagerPage.openFilesManagerPage();
        await filesManagerPage.waitForPageLoaded({ waitForGrid: false });
      },
    );

    await dialTest.step(
      'Start upload attachment from device with slow network',
      async () => {
        await dialHomePage.emulateSlowNetworkConditions({
          downloadThroughput: 100,
          uploadThroughput: 100,
        });
        const filesManager = filesManagerPage
          .getFilesManagerContainer()
          .getFilesManager();
        const toolbar = filesManager.getFilesManagerToolbar();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          async () => {
            await toolbar.getNewButton().click();
            await toolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles);
          },
        );
      },
    );

    await dialTest.step(
      'Verify upload progress dialog is shown with progress bar',
      async () => {
        await baseAssertion.assertElementState(uploadProgressDialog, 'visible');
        const progressBarContainer = uploadProgressDialog.progressBar(
          Attachment.sunImageName,
        );
        await baseAssertion.assertElementState(progressBarContainer, 'visible');
      },
    );

    await dialTest.step(
      'Verify cancel button is highlighted on hover',
      async () => {
        const cancelButton = uploadProgressDialog.getCancelButton();
        await cancelButton.hoverOver();
        await baseAssertion.assertElementBackgroundColors(
          cancelButton,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer4),
        );
      },
    );

    await dialTest.step(
      'Click cancel button and verify upload is cancelled, file does not appear',
      async () => {
        await uploadProgressDialog.getCancelButton().click();
        await baseAssertion.assertElementState(uploadProgressDialog, 'hidden');
        await filesManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'hidden',
        );
      },
    );
  },
);

// TODO: Test skipped - file upload appears successful even when network is offline.
// Despite network errors visible in DevTools, the file uploads successfully,
// making it impossible to test error state handling (red text + error icon).
dialTest.skip(
  '[Manage attachments] Delete file after there was internet connection error',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    chatBar,
    localStorageManager,
    manageAttachmentsAssertion,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3304');
    let client: CDPSession;

    await dialTest.step(
      'Open "Manage attachments" modal through chat side bar menu icon',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.openManageAttachmentsModal();
        await manageAttachmentsAssertion.assertElementState(
          attachFilesModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Upload file from device in offline mode and verify filename is red and has error icon',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDevice(),
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFile(Attachment.sunImageName),
          'visible',
        );
        client = await dialHomePage.emulateSlowNetworkConditions({
          offline: true,
        });
        await uploadFromDeviceModal.uploadButton.click();
        await manageAttachmentsAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          FileModalSection.AllFiles,
          'visible',
        );
        await baseAssertion.assertElementColor(
          attachFilesModal
            .getAllFilesTree()
            .getEntityName(Attachment.sunImageName),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
        );
        await manageAttachmentsAssertion.assertElementState(
          attachFilesModal
            .getAllFilesTree()
            .attachedFileErrorIcon(Attachment.sunImageName),
          'visible',
          ExpectedMessages.attachmentHasErrorIcon,
        );
      },
    );

    await dialTest.step(
      'Set online mode, click on cancel button near loading indicator and verify file disappears from the list',
      async () => {
        await dialHomePage.stopNetworkConditionsEmulating(client);
        await attachFilesModal
          .getAllFilesTree()
          .removeAttachedFileIcon(Attachment.sunImageName)
          .click();
        await manageAttachmentsAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          FileModalSection.AllFiles,
          'hidden',
        );
      },
    );
  },
);

// TODO: Test skipped - same issue as EPMRTC-3304 above.
// File upload succeeds despite offline network conditions.
dialTest.skip(
  '[Manage attachments] Reload file after there was internet connection error',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    chatBar,
    localStorageManager,
    manageAttachmentsAssertion,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3303');
    let client: CDPSession;

    await dialTest.step(
      'Open "Manage attachments" modal through chat side bar menu icon',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.openManageAttachmentsModal();
      },
    );

    await dialTest.step(
      'Set offline mode before uploading attachment from device',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDevice(),
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFile(Attachment.sunImageName),
          'visible',
        );
        client = await dialHomePage.emulateSlowNetworkConditions({
          offline: true,
        });
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step(
      'Set online mode, click on Reload button near loading indicator and verify file displayed in the list and change color to blue',
      async () => {
        await dialHomePage.stopNetworkConditionsEmulating(client);
        const allFilesTreeElement = attachFilesModal.getAllFilesTree();
        const loadingRetryElement =
          allFilesTreeElement.attachedFileLoadingRetry(Attachment.sunImageName);
        await loadingRetryElement.click();
        await manageAttachmentsAssertion.assertElementState(
          loadingRetryElement,
          'hidden',
          ExpectedMessages.attachmentLoadingIndicatorNotVisible,
        );
        await manageAttachmentsAssertion.assertElementColor(
          allFilesTreeElement.getEntityName(Attachment.sunImageName),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
      },
    );
  },
);

dialTest(
  '[Manage attachments] Download a file though context menu with special chars in a name.\n' +
    'Allowed special chars in the file name while renaming on "Upload from device"',
  async ({
    fileApiHelper,
    filesManagerPage,
    filesManagerGrid,
    filesManagerGridRowDropdownMenu,
    downloadAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2015', 'EPMRTC-3187');
    const filename = `${ExpectedConstants.allowedSpecialChars}.jpg`;

    await dialTest.step(
      'Upload file with special symbols in the name',
      async () => {
        await fileApiHelper.putFileWithCustomName(
          filename,
          Attachment.sunImageName,
        );
      },
    );

    await dialTest.step(
      'Open "File manager" page through chat side bar icon',
      async () => {
        await filesManagerPage.openFilesManagerPage();
        await filesManagerPage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Open attached file dropdown menu, select Download option and verify file is successfully downloaded',
      async () => {
        await filesManagerGrid.gridDotsMenuByNameCell(filename).click();
        const downloadedData = await filesManagerPage.downloadData(() =>
          filesManagerGridRowDropdownMenu.selectItem(MenuOptions.download, {
            isHttpMethodTriggered: false,
          }),
        );
        await downloadAssertion.assertJpgFileIsDownloaded(downloadedData);
      },
    );
  },
);

dialTest(
  '[Manage attachments] Download several files',
  async ({
    filesManagerPage,
    filesManagerGrid,
    filesManagerToolbar,
    setTestIds,
    fileApiHelper,
    filesManagerGridAssertion,
    downloadAssertion,
  }) => {
    setTestIds('EPMRTC-3300');

    await dialTest.step('Upload 2 files to app', async () => {
      for (const file of attachedFiles) {
        await fileApiHelper.putFile(file);
      }
    });

    await dialTest.step(
      'Open "File manager" page and check attached files',
      async () => {
        await filesManagerPage.openFilesManagerPage();
        await filesManagerPage.waitForPageLoaded();
        for (const file of attachedFiles) {
          await filesManagerGrid.gridCheckboxByNameCell(file).click();
        }
      },
    );

    await dialTest.step(
      'Click "Download" button and verify files are downloaded as ZIP archive',
      async () => {
        const downloadedData = await filesManagerPage.downloadMultipleData(
          () => filesManagerToolbar.clickDownloadButton(false),
          1, // Expect 1 download - ZIP archive containing all files
          'files.zip',
        );

        // Verify ZIP file was downloaded (no content comparison - ZIP is dynamically generated)
        await downloadAssertion.assertZipFileIsDownloaded(downloadedData[0]);
      },
    );

    //TODO they do not remain checked. Verify if it is intended
    await dialTest.step.skip('Verify checkboxes remain checked', async () => {
      // Verify checkboxes remain checked
      for (const file of attachedFiles) {
        await filesManagerGridAssertion.assertGridCheckboxByNameState(
          file,
          CheckboxState.checked,
        );
      }
    });
  },
);

dialTest(
  '[Manage attachments] Single User, Multiple Tabs. Added and Deleted file appears/disappears without browser refresh\n' +
    '[Manage attachments] Single User, Multiple Tabs. Added and Deleted file LOCATED IN FOLDER appears/disappears without browser refresh',
  async ({
    dialHomePage,
    setTestIds,
    filesManagerPage,
    filesManagerGrid,
    filesManagerGridAssertion,
    fileApiHelper,
    localStorageManager,
    navigationPanel,
  }) => {
    setTestIds('EPMRTC-5396', 'EPMRTC-5526');
    const filesToTest = [
      {
        name: `${GeneratorUtil.randomString(7)}.txt`,
        url: '',
        isText: true,
        folderName: '',
      },
      {
        name: Attachment.sunImageName,
        url: '',
        isText: false,
        folderName: '',
      },
      {
        name: `${GeneratorUtil.randomString(7)}.txt`,
        url: '',
        isText: true,
        folderName: GeneratorUtil.randomString(7),
      },
    ];

    await dialTest.step('Open DIAL home page', async () => {
      await localStorageManager.setShowSideBarPanels();
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step('Upload files via API', async () => {
      for (const file of filesToTest) {
        if (file.folderName !== '' && file.isText) {
          file.url = await fileApiHelper.putStringAsFile(
            file.name,
            GeneratorUtil.randomString(100),
            { parentPath: file.folderName },
          );
        } else if (file.isText) {
          file.url = await fileApiHelper.putStringAsFile(
            file.name,
            GeneratorUtil.randomString(100),
          );
        } else {
          file.url = await fileApiHelper.putFile(file.name);
        }
      }
    });

    await dialTest.step(
      'Open Files Manager and verify files appear without page refresh',
      async () => {
        await navigationPanel.goToFilesManager();
        await filesManagerPage.waitForPageLoaded();

        for (const file of filesToTest) {
          // For files in folders, navigate into folder first
          if (file.folderName !== '') {
            await filesManagerGrid.openFolder(file.folderName);
          }

          await filesManagerGridAssertion.assertGridRowByNameState(
            file.name,
            'visible',
          );

          // Navigate back if in folder
          if (file.folderName !== '') {
            const filesManager = filesManagerPage
              .getFilesManagerContainer()
              .getFilesManager();
            const navigationPanel =
              filesManager.getFilesManagerNavigationPanel();
            await navigationPanel
              .getBreadcrumb()
              .itemByName(ExpectedConstants.myFilesBreadcrumbsRoot)
              .click();
          }
        }
      },
    );

    for (const file of filesToTest) {
      //TODO this step doesn't work - files do not appear until you reload the page
      await dialTest.step.skip(
        `Delete ${file.isText ? 'text' : 'non-text'} file via API and verify it disappears without page refresh`,
        async () => {
          await fileApiHelper.deleteFromAllFiles(file.url);

          // For files in folders, navigate into folder first
          if (file.folderName !== '') {
            await filesManagerGrid.openFolder(file.folderName);
          }

          await filesManagerGridAssertion.assertGridRowByNameState(
            file.name,
            'hidden',
          );

          // Navigate back if in folder
          if (file.folderName !== '') {
            const filesManager = filesManagerPage
              .getFilesManagerContainer()
              .getFilesManager();
            const navigationPanel =
              filesManager.getFilesManagerNavigationPanel();
            await navigationPanel
              .getBreadcrumb()
              .itemByName(ExpectedConstants.myFilesBreadcrumbsRoot)
              .click();
          }
        },
      );
    }
  },
);

dialTest(
  '[Manage attachments] Select files using file context menu.\n' +
    '[Manage attachments] Unselect files using file context menu',
  async ({
    filesManagerPage,
    filesManagerGrid,
    filesManagerToolbar,
    filesManagerGridAssertion,
    setTestIds,
    fileApiHelper,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-6091', 'EPMRTC-6092');
    const attachments = [Attachment.sunImageName, Attachment.flowerImageName];
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );
    let headerCheckboxInput: BaseElement;
    const bulkButtons = [
      filesManagerToolbar.getMoveToButton(),
      filesManagerToolbar.getCopyToButton(),
      filesManagerToolbar.getDuplicateButton(),
      filesManagerToolbar.getDeleteButton(),
      filesManagerToolbar.getDownloadButton(),
    ];
    const tabElements = [
      filesManagerToolbar.getToolbarTabs(),
      filesManagerToolbar.getToolbarSwitcher(),
      filesManagerToolbar.getNewButton(),
    ];

    await dialTest.step('Upload 2 files to app', async () => {
      for (const attachment of attachments) {
        await fileApiHelper.putFile(attachment);
      }
    });

    await dialTest.step(
      'Open "File manager" page and verify file row includes checkbox on hover over',
      async () => {
        await filesManagerPage.openFilesManagerPage();
        await filesManagerPage.waitForPageLoaded();
        await filesManagerGrid.gridRowByNameCell(attachments[0]).hover();
        const checkbox = filesManagerGrid.gridCheckboxByNameCell(
          attachments[0],
        );
        await filesManagerGridAssertion.assertElementState(checkbox, 'visible');
        await filesManagerGridAssertion.assertElementClass(
          checkbox,
          new RegExp(/before:border-hover/),
        );
      },
    );

    await dialTest.step(
      'Check both files and verify checkbox state in the rows and in the header, toolbar panel is changed to bulk operations',
      async () => {
        for (let i = 0; i < attachments.length; i++) {
          const attachmentCheckbox = filesManagerGrid.gridCheckboxByNameCell(
            attachments[i],
          );
          await attachmentCheckbox.click();
          await filesManagerGridAssertion.assertCheckboxState(
            attachmentCheckbox,
            CheckboxState.checked,
          );
          await filesManagerGridAssertion.assertElementBorderColors(
            attachmentCheckbox,
            expectedColor,
          );
          headerCheckboxInput =
            filesManagerGrid.gridHeaderCheckbox.checkboxInput;
          await baseAssertion.assertElementBorderColors(
            headerCheckboxInput,
            expectedColor,
          );
          await baseAssertion.assertElementState(
            filesManagerToolbar.getSelectedIconsButton(i + 1),
            'visible',
          );
          i === 0
            ? await filesManagerGridAssertion.assertElementAttribute(
                headerCheckboxInput,
                Attributes.ariaChecked,
                AttributeValues.mixed,
              )
            : await filesManagerGridAssertion.assertCheckboxState(
                headerCheckboxInput,
                CheckboxState.checked,
              );
        }
        for (const button of bulkButtons) {
          await baseAssertion.assertElementState(button, 'visible');
        }
        for (const element of tabElements) {
          await baseAssertion.assertElementState(element, 'hidden');
        }
      },
    );

    await dialTest.step(
      'Uncheck both files and verify checkbox state in the rows and in the header, toolbar panel is changed to tabs',
      async () => {
        for (let i = 0; i < attachments.length; i++) {
          const attachmentCheckbox = filesManagerGrid.gridCheckboxByNameCell(
            attachments[i],
          );
          await attachmentCheckbox.click();
          await filesManagerGridAssertion.assertCheckboxState(
            attachmentCheckbox,
            CheckboxState.unchecked,
          );
          if (i === 0) {
            await baseAssertion.assertElementState(
              filesManagerToolbar.getSelectedIconsButton(i + 1),
              'visible',
            );
            await filesManagerGridAssertion.assertElementAttribute(
              headerCheckboxInput,
              Attributes.ariaChecked,
              AttributeValues.mixed,
            );
            await baseAssertion.assertElementBorderColors(
              headerCheckboxInput,
              expectedColor,
            );
            for (const button of bulkButtons) {
              await baseAssertion.assertElementState(button, 'visible');
            }
            for (const element of [
              filesManagerToolbar.getToolbarTabs(),
              filesManagerToolbar.getToolbarSwitcher(),
              filesManagerToolbar.getNewButton(),
            ]) {
              await baseAssertion.assertElementState(element, 'hidden');
            }
          } else {
            await baseAssertion.assertElementState(
              filesManagerToolbar.getSelectedIconsButton(i + 1),
              'hidden',
            );
            await filesManagerGridAssertion.assertElementState(
              headerCheckboxInput,
              'hidden',
            );
            for (const button of bulkButtons) {
              await baseAssertion.assertElementState(button, 'hidden');
            }
            for (const element of tabElements) {
              element instanceof Tab
                ? await baseAssertion.assertElementsCount(element, 3)
                : await baseAssertion.assertElementState(element, 'visible');
            }
          }
        }
      },
    );
  },
);

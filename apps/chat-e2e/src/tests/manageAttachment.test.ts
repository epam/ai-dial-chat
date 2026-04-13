import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedConfirmationPopupData,
  ExpectedConstants,
  FileManagerToolbarTabs,
  MenuOptions,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { IconSelectors } from '@/src/ui/selectors';
import { Checkbox, Tab } from '@/src/ui/webElements';
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
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridRowDropdownMenu,
    fileManagerDeleteItemConfirmationPopup,
    setTestIds,
    fileApiHelper,
    fileManagerDeleteItemConfirmationPopupAssertion,
    fileManagerGridAssertion,
  }) => {
    setTestIds('EPMRTC-1884', 'EPMRTC-3296');

    let fileDotsMenu: Locator;
    let fileRow: Locator;

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
    });

    await dialTest.step(
      'Open "File manager" page through chat side bar icon',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Open attached file dropdown menu and select Delete option',
      async () => {
        fileRow = fileManagerGrid.gridRowByNameCell(Attachment.sunImageName);
        fileDotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.sunImageName,
        );
        await fileRow.hover();
        await fileDotsMenu.click();
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.delete, {
          isHttpMethodTriggered: false,
        });
      },
    );

    await dialTest.step(
      'Verify "Confirm Deleting Item" popup with valid text appears',
      async () => {
        await fileManagerDeleteItemConfirmationPopupAssertion.assertElementState(
          fileManagerDeleteItemConfirmationPopup,
          'visible',
        );
        await fileManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConfirmationPopupData.deleteItemHeader,
        );
        await fileManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupContent(
          ExpectedConfirmationPopupData.deleteItemContent(
            Attachment.sunImageName,
          ),
        );
      },
    );

    await dialTest.step(
      'Close popup and verify file is not deleted',
      async () => {
        await fileManagerDeleteItemConfirmationPopup.getCancelButton().click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Proceed again to "Confirm Deleting Item" popup, confirm file delete and verify it disappears from the grid',
      async () => {
        await fileRow.hover();
        await fileDotsMenu.click();
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.delete, {
          isHttpMethodTriggered: false,
        });
        await fileManagerDeleteItemConfirmationPopup.confirm({
          expectedRequests: new Map([
            [API.deleteFileHost(), 'POST'],
            [API.filesListingHost(), 'GET'],
          ]),
        });
        await fileManagerGridAssertion.assertGridRowByNameState(
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
    fileManagerModalGrid,
    fileManagerModalToolbar,
    fileManagerDeleteItemConfirmationPopup,
    fileManagerDeleteItemConfirmationPopupAssertion,
    localStorageManager,
    fileManagerModalGridAssertion,
    fileManagerToolbar,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3298', 'EPMRTC-3299');
    const randomModelWithImageAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments.filter(
        (m) =>
          m.inputAttachmentTypes?.length == 1 &&
          m.inputAttachmentTypes[0] === Attachment.imageTypesExtension,
      ),
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
          randomModelWithImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
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
          const attachmentCheckbox =
            await fileManagerModalGrid.gridCheckboxByNameCell(file);
          await attachmentCheckbox.click();
        }
        const selectedFilesCounter = fileManagerToolbar.getSelectedIconsButton(
          attachedFiles.length,
        );
        await baseAssertion.assertElementState(selectedFilesCounter, 'visible');
      },
    );

    await dialTest.step(
      'Click Delete button at the bottom and verify "Confirm deleting items" popup with valid text appears',
      async () => {
        await fileManagerModalToolbar.getDeleteButton().click();
        await fileManagerDeleteItemConfirmationPopupAssertion.assertElementState(
          fileManagerDeleteItemConfirmationPopup,
          'visible',
        );
        await fileManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConfirmationPopupData.deleteItemsHeader,
        );
        await fileManagerDeleteItemConfirmationPopupAssertion.assertConfirmationPopupContent(
          ExpectedConfirmationPopupData.deleteItemsContent(
            attachedFiles.length,
          ),
        );
      },
    );

    await dialTest.step(
      'Close popup and verify files are not deleted',
      async () => {
        await fileManagerDeleteItemConfirmationPopup.getCancelButton().click();
        for (const file of attachedFiles) {
          await fileManagerModalGridAssertion.assertGridRowByNameState(
            file,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Proceed again to "Confirm deleting items" modal, confirm files delete and verify they disappear from files list',
      async () => {
        await fileManagerModalToolbar.getDeleteButton().click();
        await fileManagerDeleteItemConfirmationPopup.confirm({
          triggeredHttpMethod: 'GET',
          triggeredHttpHost: API.filesListingHost(),
        });
        for (const file of attachedFiles) {
          await fileManagerModalGridAssertion.assertGridRowByNameState(
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
    fileManagerPage,
    fileManagerGridAssertion,
    uploadProgressDialog,
    localStorageManager,
    fileManagerToolbar,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3302');

    await dialTest.step(
      'Open file manager page by direct URL navigation',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded({ isGridVisible: false });
      },
    );

    await dialTest.step(
      'Start upload attachment from device with slow network',
      async () => {
        await dialHomePage.emulateSlowNetworkConditions({
          downloadThroughput: 100,
          uploadThroughput: 100,
        });
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          async () => {
            await fileManagerToolbar.getNewButton().click();
            await fileManagerToolbar
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
        await baseAssertion.assertElementText(
          uploadProgressDialog.uploadingItemName,
          Attachment.sunImageName,
        );
        const extension = Attachment.sunImageName.substring(
          Attachment.sunImageName.lastIndexOf('.') + 1,
        );
        await baseAssertion.assertElementClass(
          uploadProgressDialog.fileTypeIcon,
          IconSelectors.fileTypeIcon(extension),
        );
        await baseAssertion.assertElementState(
          uploadProgressDialog.uploadingIndicator,
          'visible',
        );
        await baseAssertion.assertElementText(
          uploadProgressDialog.uploadingItemsCount,
          ExpectedConstants.uploadingItemsMessage(1),
        );
      },
    );

    await dialTest.step(
      'Verify cancel button is highlighted on hover',
      async () => {
        const cancelButton = uploadProgressDialog.getCancelButton();
        await cancelButton.hoverOver();
        await baseAssertion.assertElementBackgroundColors(
          cancelButton,
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.controlsBgNeutralHover,
          ),
        );
      },
    );

    await dialTest.step(
      'Click cancel button and verify upload is cancelled, file does not appear',
      async () => {
        await uploadProgressDialog.getCancelButton().click();
        await baseAssertion.assertElementState(uploadProgressDialog, 'hidden');
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  '[Manage attachments] Upload file after there was internet connection error',
  async ({
    dialHomePage,
    setTestIds,
    toast,
    toastAssertion,
    fileManagerPage,
    fileManagerToolbar,
    fileManagerGridAssertion,
  }) => {
    setTestIds('EPMRTC-3304');
    let client: CDPSession;

    await dialTest.step(
      'Open "File manager" page and set offline mode',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded({ isGridVisible: false });
        await fileManagerToolbar.getNewButton().click();
        client = await dialHomePage.emulateSlowNetworkConditions({
          offline: true,
        });
      },
    );

    await dialTest.step(
      'Upload file in offline mode and verify error toast is displayed',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            fileManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles),
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.uploadFailedMessage,
        );
        await toast.closeToast();
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Set online mode and verify file is successfully uploaded',
      async () => {
        await dialHomePage.stopNetworkConditionsEmulating(client);
        await fileManagerToolbar.getNewButton().click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            fileManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles),
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[File Manager][My Files] Delete file after there was internet connection error',
  async ({
    dialHomePage,
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridRowDropdownMenu,
    fileManagerDeleteItemConfirmationPopup,
    fileManagerGridAssertion,
    toastAssertion,
  }) => {
    setTestIds('EPMRTC-8176');
    let client: CDPSession;

    await dialTest.step('Upload file to app via API', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
    });

    await dialTest.step(
      'Open "File Manager" page and set offline mode',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        client = await dialHomePage.emulateSlowNetworkConditions({
          offline: true,
        });
      },
    );

    await dialTest.step(
      'Open file context menu and select Delete option',
      async () => {
        const fileRow = fileManagerGrid.gridRowByNameCell(
          Attachment.sunImageName,
        );
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.sunImageName,
        );
        await fileRow.hover();
        await dotsMenu.click();
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.delete, {
          isHttpMethodTriggered: false,
        });
      },
    );

    await dialTest.step(
      'Confirm delete and verify error toast is shown',
      async () => {
        await fileManagerDeleteItemConfirmationPopup.getConfirmButton().click();
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.failedToDeleteFilesMessage,
        );
      },
    );

    await dialTest.step(
      'Verify file is not deleted and restore network connection',
      async () => {
        await dialHomePage.stopNetworkConditionsEmulating(client);
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Reload page and verify file is not deleted',
      async () => {
        await dialHomePage.reloadPage();
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
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
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridRowDropdownMenu,
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
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Open attached file dropdown menu, select Download option and verify file is successfully downloaded',
      async () => {
        await fileManagerGrid.gridRowByNameCell(filename).hover();
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(filename);
        await dotsMenu.click();
        const downloadedData = await fileManagerPage.downloadData(() =>
          fileManagerGridRowDropdownMenu.selectItem(MenuOptions.download, {
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
    fileManagerPage,
    fileManagerGrid,
    fileManagerToolbar,
    setTestIds,
    fileApiHelper,
    fileManagerGridAssertion,
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
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        for (const file of attachedFiles) {
          const attachmentCheckbox =
            await fileManagerGrid.gridCheckboxByNameCell(file);
          await attachmentCheckbox.click();
        }
      },
    );

    await dialTest.step(
      'Click "Download" button and verify files are downloaded as ZIP archive',
      async () => {
        const downloadedData = await fileManagerPage.downloadMultipleData(
          () => fileManagerToolbar.clickDownloadButton(false),
          1, // Expect 1 download - ZIP archive containing all files
          'files.zip',
        );

        // Verify ZIP file was downloaded (no content comparison - ZIP is dynamically generated)
        await downloadAssertion.assertZipFileIsDownloaded(downloadedData[0]);
      },
    );

    await dialTest.step('Verify checkboxes are not checked', async () => {
      // Verify checkboxes remain checked
      for (const file of attachedFiles) {
        await fileManagerGridAssertion.assertGridCheckboxByNameState(
          file,
          CheckboxState.unchecked,
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
    fileManagerPage,
    fileManagerGrid,
    fileManagerToolbar,
    fileManagerGridAssertion,
    fileApiHelper,
    localStorageManager,
    fileManager,
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
      'Open File Manager and verify files appear without page refresh',
      async () => {
        await navigationPanel.goToFileManager();
        await fileManagerPage.waitForPageLoaded();

        for (const file of filesToTest) {
          // For files in folders, navigate into folder first
          if (file.folderName !== '') {
            await fileManagerGrid.openFolder(file.folderName);
          }

          await fileManagerGridAssertion.assertGridRowByNameState(
            file.name,
            'visible',
          );

          if (file.folderName !== '') {
            await fileManager
              .getFileManagerNavigationPanel()
              .getBreadcrumb()
              .itemByName(FileManagerToolbarTabs.MyFiles)
              .click();
          }
        }
      },
    );

    for (const file of filesToTest) {
      //TODO enable when fixed https://github.com/epam/ai-dial-chat/issues/5706
      await dialTest.step.skip(
        `Delete ${file.isText ? 'text' : 'non-text'} file via API and verify it disappears without page refresh`,
        async () => {
          await fileApiHelper.deleteFromAllFiles(file.url);
          await fileManagerToolbar.sharedWithMeTab.click();
          await fileManagerToolbar.myFilesTab.click();

          // For files in folders, navigate into folder first
          if (file.folderName !== '') {
            await fileManagerGrid.openFolder(file.folderName);
          }

          await fileManagerGridAssertion.assertGridRowByNameState(
            file.name,
            'hidden',
          );

          if (file.folderName !== '') {
            await fileManager
              .getFileManagerNavigationPanel()
              .getBreadcrumb()
              .itemByName(FileManagerToolbarTabs.MyFiles)
              .click();
          }
        },
      );
    }
  },
);

dialTest(
  '[File Manager][My Files]: files from hidden folders are displayed in search results when Hidden files toggle is on',
  async ({
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGridAssertion,
    fileManagerNavigationPanel,
    fileManagerToolbar,
  }) => {
    setTestIds('EPMRTC-8130');

    const visibleFolder = 'Folder1';
    const hiddenFolder = '.Folder2';
    const hiddenFileInVisibleFolder = '.Search1.txt';
    const visibleFileInVisibleFolder = 'Search2.txt';
    const hiddenFileInHiddenFolder = '.Search3.txt';
    const visibleFileInHiddenFolder = 'Search4.txt';
    const searchTerm = 'Search';

    await dialTest.step('Upload test files via API', async () => {
      await fileApiHelper.putStringAsFile(
        visibleFileInVisibleFolder,
        'content',
        { parentPath: visibleFolder },
      );
      await fileApiHelper.putStringAsFile(
        hiddenFileInVisibleFolder,
        'content',
        { parentPath: visibleFolder },
      );
      await fileApiHelper.putStringAsFile(
        visibleFileInHiddenFolder,
        'content',
        { parentPath: hiddenFolder },
      );
      await fileApiHelper.putStringAsFile(hiddenFileInHiddenFolder, 'content', {
        parentPath: hiddenFolder,
      });
    });

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'Search "Search" and verify only visible file in visible folder is shown',
      async () => {
        await fileManagerNavigationPanel
          .getSearch()
          .inputField.fillInInput(searchTerm);
        await fileManagerGridAssertion.assertGridRowByNameState(
          visibleFileInVisibleFolder,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileInVisibleFolder,
          'hidden',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          visibleFileInHiddenFolder,
          'hidden',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileInHiddenFolder,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Turn on Hidden files toggle and verify all 4 files are shown',
      async () => {
        await fileManagerToolbar.getToolbarSwitcher().switcher.click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          visibleFileInVisibleFolder,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileInVisibleFolder,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          visibleFileInHiddenFolder,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileInHiddenFolder,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Turn off Hidden files toggle and verify only visible file in visible folder is shown',
      async () => {
        await fileManagerToolbar.getToolbarSwitcher().switcher.click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          visibleFileInVisibleFolder,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileInVisibleFolder,
          'hidden',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          visibleFileInHiddenFolder,
          'hidden',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileInHiddenFolder,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  '[Manage attachments] Select files using file context menu.\n' +
    '[Manage attachments] Unselect files using file context menu',
  async ({
    fileManagerPage,
    fileManagerGrid,
    fileManagerToolbar,
    fileManagerGridAssertion,
    setTestIds,
    fileApiHelper,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-6091', 'EPMRTC-6092');
    const attachments = [Attachment.sunImageName, Attachment.flowerImageName];
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.controlsBgAccent,
    );
    let headerCheckbox: Checkbox;
    const bulkButtons = [
      fileManagerToolbar.getMoveToButton(),
      fileManagerToolbar.getCopyToButton(),
      fileManagerToolbar.getDuplicateButton(),
      fileManagerToolbar.getDeleteButton(),
      fileManagerToolbar.getDownloadButton(),
    ];
    const tabElements = [
      fileManagerToolbar.getToolbarTabs(),
      fileManagerToolbar.getToolbarSwitcher(),
      fileManagerToolbar.getNewButton(),
    ];

    await dialTest.step('Upload 2 files to app', async () => {
      for (const attachment of attachments) {
        await fileApiHelper.putFile(attachment);
      }
    });

    await dialTest.step(
      'Open "File manager" page and verify file row includes checkbox on hover over',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        const attachmentLocator = await fileManagerGrid.goToGridRowByNameCell(
          attachments[0],
        );
        await attachmentLocator.hover();
        const checkbox = await fileManagerGrid.gridCheckboxByNameCell(
          attachments[0],
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          attachments[0],
          'visible',
        );
        await fileManagerGridAssertion.assertElementState(checkbox, 'visible');
      },
    );

    await dialTest.step(
      'Check both files and verify checkbox state in the rows and in the header, toolbar panel is changed to bulk operations',
      async () => {
        for (let i = 0; i < attachments.length; i++) {
          const attachmentCheckbox =
            await fileManagerGrid.gridCheckboxByNameCell(attachments[i]);
          await attachmentCheckbox.click();
          await fileManagerGridAssertion.assertGridCheckboxByNameState(
            attachments[i],
            CheckboxState.checked,
          );
          await fileManagerGridAssertion.assertGridCheckboxBorderColors(
            attachments[i],
            expectedColor,
          );
          headerCheckbox = fileManagerGrid.gridHeaderCheckbox;
          await baseAssertion.assertElementBorderColors(
            headerCheckbox,
            expectedColor,
          );
          await baseAssertion.assertElementState(
            fileManagerToolbar.getSelectedIconsButton(i + 1),
            'visible',
          );
          await baseAssertion.assertCheckboxState(
            headerCheckbox.checkboxInput,
            i === 0 ? CheckboxState.partiallyChecked : CheckboxState.checked,
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
          const attachmentCheckbox =
            await fileManagerGrid.gridCheckboxByNameCell(attachments[i]);
          await attachmentCheckbox.click();
          await fileManagerGridAssertion.assertGridCheckboxByNameState(
            attachments[i],
            CheckboxState.unchecked,
          );
          if (i === 0) {
            await baseAssertion.assertElementState(
              fileManagerToolbar.getSelectedIconsButton(i + 1),
              'visible',
            );
            await baseAssertion.assertCheckboxState(
              headerCheckbox.checkboxInput,
              CheckboxState.partiallyChecked,
            );
            await baseAssertion.assertElementBorderColors(
              headerCheckbox,
              expectedColor,
            );
            for (const button of bulkButtons) {
              await baseAssertion.assertElementState(button, 'visible');
            }
            for (const element of [
              fileManagerToolbar.getToolbarTabs(),
              fileManagerToolbar.getToolbarSwitcher(),
              fileManagerToolbar.getNewButton(),
            ]) {
              await baseAssertion.assertElementState(element, 'hidden');
            }
          } else {
            await baseAssertion.assertElementState(
              fileManagerToolbar.getSelectedIconsButton(i + 1),
              'hidden',
            );
            await fileManagerGridAssertion.assertCheckboxState(
              headerCheckbox.checkboxInput,
              CheckboxState.unchecked,
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

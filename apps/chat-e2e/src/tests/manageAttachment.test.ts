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
import { keys } from '@/src/ui/keyboard';
import { IconSelectors } from '@/src/ui/selectors';
import { Checkbox, Tab } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil, filenamePrefix } from '@/src/utils';
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
        await fileManagerPage.reloadPage();
        await fileManagerPage.waitForPageLoaded();
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
    const filename = `${filenamePrefix}${ExpectedConstants.allowedSpecialChars}.jpg`;

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
        name: GeneratorUtil.randomFilename('txt'),
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
        name: GeneratorUtil.randomFilename('txt'),
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
  '[File Manager][MyFiles]: Search files in folders.\n' +
    '[File Manager][My Files]: Search files when no folders in the structure.\n' +
    '[File Manager][My files] Search files when nothing found',
  async ({
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerNavigationPanel,
    fileManagerGridAssertion,
    fileManager,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3301', 'EPMRTC-3306', 'EPMRTC-3307');

    const folder1 = GeneratorUtil.randomString(7);
    const folder2 = GeneratorUtil.randomString(7);
    // EPMRTC-3301: files inside folders (case variants: lowercase 'n' and capital 'N')
    const folderFile1 = GeneratorUtil.filename(' File name', 'png');
    const folderFile2 = GeneratorUtil.filename(' File Name', 'txt');
    // EPMRTC-3306 / EPMRTC-3307: files in root (three case variants)
    const rootFile1 = GeneratorUtil.filename(' File Name', 'png');
    const rootFile2 = GeneratorUtil.filename(' file name1 ', 'pdf');
    const rootFile3 = GeneratorUtil.filename(' file Name', 'txt');
    const rootFiles = [rootFile1, rootFile2, rootFile3];

    await dialTest.step(
      'Upload test files via API: 2 files in separate folders + 3 files in root',
      async () => {
        await fileApiHelper.putFileWithCustomName(
          folderFile1,
          Attachment.sunImageName,
          { parentPath: folder1 },
        );
        await fileApiHelper.putFileWithCustomName(
          folderFile2,
          Attachment.sunImageName,
          { parentPath: folder2 },
        );
        await fileApiHelper.putFileWithCustomName(
          rootFile1,
          Attachment.sunImageName,
        );
        await fileApiHelper.putFileWithCustomName(
          rootFile2,
          Attachment.flowerImageName,
        );
        await fileApiHelper.putFileWithCustomName(
          rootFile3,
          Attachment.sunImageName,
        );
      },
    );

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'EPMRTC-3301: search "name" and verify files inside folders are found',
      async () => {
        await fileManagerNavigationPanel
          .getSearch()
          .inputField.fillInInput('name');
        await fileManagerGridAssertion.assertGridRowByNameState(
          folderFile1,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          folderFile2,
          'visible',
        );
      },
    );

    await dialTest.step(
      'EPMRTC-3306: search "File Name" and verify all root files are found regardless of case',
      async () => {
        await fileManagerNavigationPanel
          .getSearch()
          .inputField.fillInInput('File Name');
        for (const file of rootFiles) {
          await fileManagerGridAssertion.assertGridRowByNameState(
            file,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'EPMRTC-3307: search non-existent term and verify "No results found" is shown',
      async () => {
        await fileManagerNavigationPanel
          .getSearch()
          .inputField.fillInInput('ABC');
        await baseAssertion.assertElementState(
          fileManager.getNoDataContent(),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Clear search and verify all files and folders are visible again',
      async () => {
        await fileManagerNavigationPanel.getSearch().inputField.fillInInput('');
        for (const folder of [folder1, folder2]) {
          await fileManagerGridAssertion.assertGridRowByNameState(
            folder,
            'visible',
          );
        }
        for (const file of rootFiles) {
          await fileManagerGridAssertion.assertGridRowByNameState(
            file,
            'visible',
          );
        }
      },
    );
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
    const hiddenFileInVisibleFolder =
      '.' + GeneratorUtil.filename('Search1', 'txt');
    const visibleFileInVisibleFolder = GeneratorUtil.filename('Search2', 'txt');
    const hiddenFileInHiddenFolder =
      '.' + GeneratorUtil.filename('Search3', 'txt');
    const visibleFileInHiddenFolder = GeneratorUtil.filename('Search4', 'txt');
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

dialTest(
  '[File Manager][My Files]: Duplicate folder.\n' +
    '[File Manager][My Files]: Duplicate file',
  async ({
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridAssertion,
    fileManagerGridRowDropdownMenu,
    fileManager,
    toastAssertion,
    toast,
  }) => {
    setTestIds('EPMRTC-8644', 'EPMRTC-8642');

    const folderName = GeneratorUtil.randomString(7);
    const duplicatedFolderName = `${folderName} (1)`;
    const duplicatedFileName = ExpectedConstants.duplicatedFileName(
      Attachment.flowerImageName,
    );

    await dialTest.step('Upload test files via API', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName, {
        parentPath: folderName,
      });
      await fileApiHelper.putFile(Attachment.flowerImageName);
    });

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'EPMRTC-8644: open folder context menu and select Duplicate option',
      async () => {
        const folderRow = fileManagerGrid.gridRowByNameCell(folderName);
        const folderDotsMenu =
          await fileManagerGrid.gridDotsMenuByNameCell(folderName);
        await folderRow.hover();
        await folderDotsMenu.click();
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.duplicate, {
          triggeredHttpMethod: 'POST',
          apiHost: API.copyFilesHost,
        });
      },
    );

    await dialTest.step(
      'EPMRTC-8644: verify success toast is shown and duplicated folder appears in grid',
      async () => {
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.itemCopiedToMyFilesMessage(duplicatedFolderName),
        );
        await toast.closeToast();
        await fileManagerGridAssertion.assertGridRowByNameState(
          duplicatedFolderName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8644: navigate into duplicated folder and verify content is copied',
      async () => {
        await fileManagerGrid.openFolder(duplicatedFolderName);
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        await fileManager
          .getFileManagerNavigationPanel()
          .getBreadcrumb()
          .itemByName(FileManagerToolbarTabs.MyFiles)
          .click();
      },
    );

    await dialTest.step(
      'EPMRTC-8642: open file context menu and select Duplicate option',
      async () => {
        const fileRow = fileManagerGrid.gridRowByNameCell(
          Attachment.flowerImageName,
        );
        const fileDotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.flowerImageName,
        );
        await fileRow.hover();
        await fileDotsMenu.click();
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.duplicate, {
          triggeredHttpMethod: 'POST',
          apiHost: API.copyFilesHost,
        });
      },
    );

    await dialTest.step(
      'EPMRTC-8642: verify success toast is shown and duplicated file appears in grid',
      async () => {
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.itemCopiedToMyFilesMessage(duplicatedFileName),
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          duplicatedFileName,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[File Manager]: restricted symbols are replaced with symbol _ while upload',
  async ({
    setTestIds,
    dialHomePage,
    fileManagerPage,
    fileManagerToolbar,
    fileManagerGridAssertion,
  }) => {
    setTestIds('EPMRTC-8300');

    const expectedFilename = ExpectedConstants.replacedRestrictedCharsName(
      Attachment.restrictedCharsFilename.toLowerCase(),
    );

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded({ isGridVisible: false });
    });

    await dialTest.step(
      'Upload file with restricted symbols via New > Upload Files',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.restrictedCharsFilename, dataType: 'upload' },
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
      'Verify file appears in grid with restricted symbols replaced by "_"',
      async () => {
        await fileManagerGridAssertion.assertGridRowByNameState(
          expectedFilename,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[File Manager]: File icon is displayed for all types of files, also for files without extension',
  async ({
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGridAssertion,
  }) => {
    setTestIds('EPMRTC-8158');

    const iconFiles = [
      { name: Attachment.sunImageName, extension: 'jpg' },
      { name: Attachment.fileToCopyName, extension: 'png' },
      { name: Attachment.pdfName, extension: 'pdf' },
      { name: Attachment.fileWithoutExtension, extension: null },
    ];

    await dialTest.step(
      'Upload files with different extensions and file without extension via API',
      async () => {
        for (const file of iconFiles) {
          await fileApiHelper.putFile(file.name);
        }
      },
    );

    await dialTest.step(
      'Open File Manager and verify each file has an icon with correct extension class',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        for (const file of iconFiles) {
          await fileManagerGridAssertion.assertGridFileIconClass(
            file.name,
            file.extension
              ? IconSelectors.fileTypeIcon(file.extension)
              : IconSelectors.defaultFileIconClass,
          );
        }
      },
    );
  },
);

dialTest(
  '[File Manager]: Informational hint appears when adding a dot at the beginning of file name; disappears when removing.\n' +
    '[File Manager]: Informational hint appears when adding a dot at the beginning of folder name; disappears when removing.\n' +
    '[File Manager]: Rename: File icon is not changed while renaming.\n' +
    '[File Manager]: Dot at the beginning of file name makes file hidden.\n' +
    '[File Manager]: Dot at the beginning of folder name makes folder hidden',
  async ({
    page,
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridAssertion,
    fileManagerGridRowDropdownMenu,
    fileManagerToolbar,
  }) => {
    setTestIds(
      'EPMRTC-8360',
      'EPMRTC-8596',
      'EPMRTC-8389',
      'EPMRTC-8363',
      'EPMRTC-8362',
    );
    const folderName = GeneratorUtil.randomString(7);
    const renamedBaseName = GeneratorUtil.randomFilename('jpg');
    const renamedFileName = `${renamedBaseName}.txt`;
    const hiddenFileName = '.' + renamedFileName;
    const hiddenFolderName = '.' + folderName;

    await dialTest.step('Upload file and create folder via API', async () => {
      await fileApiHelper.putStringAsFile(Attachment.textName, 'content');
      await fileApiHelper.putFile(Attachment.sunImageName, {
        parentPath: folderName,
      });
    });

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'EPMRTC-8360: Open rename for file, type dot at beginning and verify warning icon appears',
      async () => {
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.textName,
        );
        await dotsMenu.click({ force: true });
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerGrid
          .getRenameInput()
          .fillInInput('.' + Attachment.textName);
        await fileManagerGridAssertion.assertInputWarning();
      },
    );

    await dialTest.step(
      'EPMRTC-8360: Remove dot from file name and verify warning icon disappears',
      async () => {
        await fileManagerGrid.getRenameInput().fillInInput(Attachment.textName);
        await fileManagerGridAssertion.assertInputWarning('hidden');
        await page.keyboard.press(keys.escape);
      },
    );

    await dialTest.step(
      'EPMRTC-8596: Open rename for folder, type dot at beginning and verify warning icon appears',
      async () => {
        const dotsMenu =
          await fileManagerGrid.gridDotsMenuByNameCell(folderName);
        await dotsMenu.click({ force: true });
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerGrid.getRenameInput().fillInInput('.' + folderName);
        await fileManagerGridAssertion.assertInputWarning();
      },
    );

    await dialTest.step(
      'EPMRTC-8596: Remove dot from folder name and verify warning icon disappears',
      async () => {
        await fileManagerGrid.getRenameInput().fillInInput(folderName);
        await fileManagerGridAssertion.assertInputWarning('hidden');
        await page.keyboard.press(keys.escape);
      },
    );

    await dialTest.step(
      'EPMRTC-8389: Verify txt icon before rename; open rename, verify icon unchanged while editing; save and verify icon unchanged after',
      async () => {
        await fileManagerGridAssertion.assertGridFileIconClass(
          Attachment.textName,
          IconSelectors.fileTypeIcon('txt'),
        );
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.textName,
        );
        await dotsMenu.click({ force: true });
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerGrid.getRenameInput().fillInInput(renamedBaseName);
        await fileManagerGridAssertion.assertGridFileIconClassDuringRename(
          IconSelectors.fileTypeIcon('txt'),
        );
        await fileManagerGrid.saveRename();
        await fileManagerGridAssertion.assertGridFileIconClass(
          renamedFileName,
          IconSelectors.fileTypeIcon('txt'),
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8363: Rename file with dot prefix and verify it disappears from grid',
      async () => {
        await fileManagerGrid.renameFile(renamedFileName, hiddenFileName);
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileName,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8362: Rename folder with dot prefix and verify it disappears from grid',
      async () => {
        await fileManagerGrid.renameFile(folderName, hiddenFolderName);
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFolderName,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8362, EPMRTC-8363: Turn on Hidden toggle and verify both hidden items become visible',
      async () => {
        await fileManagerToolbar.getToolbarSwitcher().switcher.click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFolderName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8362, EPMRTC-8363: Turn off Hidden toggle and verify both items are hidden again',
      async () => {
        await fileManagerToolbar.getToolbarSwitcher().switcher.click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFileName,
          'hidden',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          hiddenFolderName,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  '[File Manager]: each opening of Replace/Duplicate form default value is selected for one file\n' +
    '[File Manager]: upload one file with the same name as exist. Select Replace\n' +
    '[File Manager]: upload one file with the same name as exist. Select Duplicate',
  async ({
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridRowDropdownMenu,
    fileManagerToolbar,
    fileManagerGridAssertion,
    fileConflictConfirmationPopup,
    fileConflictConfirmationPopupAssertion,
    downloadAssertion,
    dialHomePage,
  }) => {
    setTestIds('EPMRTC-8532', 'EPMRTC-8291', 'EPMRTC-8295');

    const duplicatedFilename = ExpectedConstants.duplicatedFileName(
      Attachment.sunImageName,
    );

    const radioDefaults: Array<['replace' | 'duplicate', CheckboxState]> = [
      ['replace', CheckboxState.checked],
      ['duplicate', CheckboxState.unchecked],
    ];

    await dialTest.step(
      'Upload cloud.jpg content as sun.jpg name via API (different file to verify replace later)',
      async () => {
        await fileApiHelper.putFileWithCustomName(
          Attachment.sunImageName,
          Attachment.cloudImageName,
        );
      },
    );

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'EPMRTC-8532: Upload conflict — verify header and Replace is default, Cancel',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          async () => {
            await fileManagerToolbar.getNewButton().click();
            await fileManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles);
          },
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConstants.replaceAttachmentConfirmationTitle,
        );
        for (const [value, state] of radioDefaults) {
          await fileConflictConfirmationPopupAssertion.assertSingleFileRadioChecked(
            value,
            state,
          );
        }
        await fileConflictConfirmationPopup.getCancelButton().click();
      },
    );

    await dialTest.step(
      'EPMRTC-8532 + EPMRTC-8291: Upload conflict — verify Replace is still default, confirm Replace and verify content',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          async () => {
            await fileManagerToolbar.getNewButton().click();
            await fileManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles);
          },
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConstants.replaceAttachmentConfirmationTitle,
        );
        for (const [value, state] of radioDefaults) {
          await fileConflictConfirmationPopupAssertion.assertSingleFileRadioChecked(
            value,
            state,
          );
        }
        await fileConflictConfirmationPopup.confirm({
          triggeredHttpMethod: 'PUT',
          triggeredHttpHost: API.fileHost(),
        });
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          duplicatedFilename,
          'hidden',
        );
        await fileManagerGrid
          .gridRowByNameCell(Attachment.sunImageName)
          .hover();
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.sunImageName,
        );
        await dotsMenu.click();
        const downloadedData = await fileManagerPage.downloadData(() =>
          fileManagerGridRowDropdownMenu.selectItem(MenuOptions.download, {
            isHttpMethodTriggered: false,
          }),
        );
        await downloadAssertion.assertJpgFileIsDownloaded(
          downloadedData,
          Attachment.sunImageName,
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8532 + EPMRTC-8295: Upload conflict — verify Replace is still default, select Duplicate and verify duplicate content',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          async () => {
            await fileManagerToolbar.getNewButton().click();
            await fileManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles);
          },
        );
        for (const [value, state] of radioDefaults) {
          await fileConflictConfirmationPopupAssertion.assertSingleFileRadioChecked(
            value,
            state,
          );
        }
        await fileConflictConfirmationPopup.selectSingleFileAction('duplicate');
        await fileConflictConfirmationPopup.confirm({
          triggeredHttpMethod: 'PUT',
          triggeredHttpHost: API.fileHost(),
        });
        await fileManagerGridAssertion.assertGridRowByNameState(
          duplicatedFilename,
          'visible',
        );
        await fileManagerGrid.gridRowByNameCell(duplicatedFilename).hover();
        const dotsMenu =
          await fileManagerGrid.gridDotsMenuByNameCell(duplicatedFilename);
        await dotsMenu.click();
        const downloadedData = await fileManagerPage.downloadData(() =>
          fileManagerGridRowDropdownMenu.selectItem(MenuOptions.download, {
            isHttpMethodTriggered: false,
          }),
        );
        await downloadAssertion.assertJpgFileIsDownloaded(
          downloadedData,
          Attachment.sunImageName,
        );
      },
    );
  },
);

dialTest(
  '[File Manager]: upload group of files where one has with same name as exist. Select Cancel\n' +
    '[File Manager]: each opening of Replace/Duplicate form default value is selected for group of files\n' +
    '[File Manager]: upload group of files where one has with same name as exist. Select Replace',
  async ({
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridRowDropdownMenu,
    fileManagerToolbar,
    fileManagerGridAssertion,
    fileConflictConfirmationPopup,
    fileConflictConfirmationPopupAssertion,
    downloadAssertion,
    dialHomePage,
  }) => {
    setTestIds('EPMRTC-8465', 'EPMRTC-8531', 'EPMRTC-8292');

    const radioDefaults: Array<['replace' | 'duplicate', CheckboxState]> = [
      ['replace', CheckboxState.checked],
      ['duplicate', CheckboxState.unchecked],
    ];

    await dialTest.step(
      'Upload cloud.jpg content as sun.jpg name via API (different file to verify replace later)',
      async () => {
        await fileApiHelper.putFileWithCustomName(
          Attachment.sunImageName,
          Attachment.cloudImageName,
        );
      },
    );

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'EPMRTC-8465: Upload group with one conflict, click Cancel — conflicting file stays, others are uploaded',
      async () => {
        await dialHomePage.uploadData(
          {
            path: [
              Attachment.sunImageName,
              Attachment.cloudImageName,
              Attachment.flowerImageName,
            ],
            dataType: 'upload',
          },
          async () => {
            await fileManagerToolbar.getNewButton().click();
            await fileManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles);
          },
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConstants.replaceAttachmentConfirmationTitle,
        );
        for (const [value, state] of radioDefaults) {
          await fileConflictConfirmationPopupAssertion.assertSingleFileRadioChecked(
            value,
            state,
          );
        }
        await fileConflictConfirmationPopup.getCancelButton().click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.cloudImageName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.flowerImageName,
          'visible',
        );
        await fileApiHelper.putFileWithCustomName(
          Attachment.cloudImageName,
          Attachment.sunImageName,
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8531, EPMRTC-8292: Upload group with multiple conflicts — verify Replace all is default, confirm and verify files are replaced',
      async () => {
        await dialHomePage.uploadData(
          {
            path: [Attachment.sunImageName, Attachment.cloudImageName],
            dataType: 'upload',
          },
          async () => {
            await fileManagerToolbar.getNewButton().click();
            await fileManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles);
          },
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConstants.replaceGroupAttachmentConfirmationTitle,
        );
        await fileConflictConfirmationPopupAssertion.assertMultipleFilesRadioChecked(
          'replaceAll',
          CheckboxState.checked,
        );
        await fileConflictConfirmationPopupAssertion.assertMultipleFilesRadioChecked(
          'duplicateAll',
          CheckboxState.unchecked,
        );
        await fileConflictConfirmationPopupAssertion.assertMultipleFilesRadioChecked(
          'decideForEach',
          CheckboxState.unchecked,
        );
        await fileConflictConfirmationPopup.confirm({
          triggeredHttpMethod: 'PUT',
          triggeredHttpHost: API.fileHost(),
        });
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.cloudImageName,
          'visible',
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.flowerImageName,
          'visible',
        );
        for (const file of [
          Attachment.sunImageName,
          Attachment.cloudImageName,
        ]) {
          await fileManagerGrid.gridRowByNameCell(file).hover();
          const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(file);
          await dotsMenu.click();
          const downloaded = await fileManagerPage.downloadData(() =>
            fileManagerGridRowDropdownMenu.selectItem(MenuOptions.download, {
              isHttpMethodTriggered: false,
            }),
          );
          await downloadAssertion.assertJpgFileIsDownloaded(downloaded, file);
        }
      },
    );
  },
);

dialTest(
  '[File Manager][My Files]: Validation happen when add dot to the end of folder name\n' +
    '[File Manager][My Files]: Validation happen when add dot to the end of file name for file without extension',
  async ({
    page,
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridAssertion,
    fileManagerGridRowDropdownMenu,
    tooltipPortalAssertion,
  }) => {
    setTestIds('EPMRTC-8184', 'EPMRTC-8183');

    const folderName = GeneratorUtil.randomString(7);

    await dialTest.step(
      'Upload file without extension and create folder via API',
      async () => {
        await fileApiHelper.putStringAsFile(
          Attachment.fileWithoutExtension,
          'content',
        );
        await fileApiHelper.putFile(Attachment.sunImageName, {
          parentPath: folderName,
        });
      },
    );

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'EPMRTC-8184: Rename folder, add dot at the end, verify error icon appears and tooltip shows correct message',
      async () => {
        const dotsMenu =
          await fileManagerGrid.gridDotsMenuByNameCell(folderName);
        await dotsMenu.click({ force: true });
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerGrid.getRenameInput().fillInInput(folderName + '.');
        await fileManagerGridAssertion.assertInputError();
        await fileManagerGrid.gridNameCellInput.alertIcon.hoverOver();
        await tooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.folderNameWithDotErrorMessage,
        );
        await page.keyboard.press(keys.escape);
      },
    );

    await dialTest.step(
      'EPMRTC-8183: Rename file without extension, add dot at the end, verify error icon appears and tooltip shows correct message',
      async () => {
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(
          Attachment.fileWithoutExtension,
        );
        await dotsMenu.click({ force: true });
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerGrid
          .getRenameInput()
          .fillInInput(Attachment.fileWithoutExtension + '.');
        await fileManagerGridAssertion.assertInputError();
        await fileManagerGrid.gridNameCellInput.alertIcon.hoverOver();
        await tooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.fileNameWithDotErrorMessage,
        );
      },
    );
  },
);

dialTest(
  '[File Manager]: Rename folder from grid\n' +
    '[File Manager]: Rename folder from folder tree when selected the same folder\n' +
    '[File Manager]: Rename folder from folder tree when selected another folder',
  async ({
    setTestIds,
    fileApiHelper,
    fileManagerPage,
    fileManagerGrid,
    fileManagerGridAssertion,
    fileManagerGridRowDropdownMenu,
    fileManagerFoldersTree,
    fileManagerFoldersTreeAssertion,
  }) => {
    setTestIds('EPMRTC-8175', 'EPMRTC-8173', 'EPMRTC-8174');

    const folderA = GeneratorUtil.randomString(7);
    const folderARenamedName = GeneratorUtil.randomString(7);
    const folderB = GeneratorUtil.randomString(7);
    const folderBRenamedName = GeneratorUtil.randomString(7);
    const folderC = GeneratorUtil.randomString(7);

    await dialTest.step('Create three folders via API', async () => {
      await fileApiHelper.putStringAsFile('.dial_folder', '', {
        parentPath: folderA,
      });
      await fileApiHelper.putStringAsFile('.dial_folder', '', {
        parentPath: folderB,
      });
      await fileApiHelper.putStringAsFile('.dial_folder', '', {
        parentPath: folderC,
      });
    });

    await dialTest.step('Open File Manager page', async () => {
      await fileManagerPage.openFileManagerPage();
      await fileManagerPage.waitForPageLoaded();
    });

    await dialTest.step(
      'EPMRTC-8175: Rename folder from grid context menu and verify updated name in grid and folder tree',
      async () => {
        const dotsMenu = await fileManagerGrid.gridDotsMenuByNameCell(folderA);
        await dotsMenu.click({ force: true });
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerGrid.getRenameInput().fillInInput(folderARenamedName);
        await fileManagerGrid.saveRename();
        await fileManagerGridAssertion.assertGridRowByNameState(
          folderARenamedName,
          'visible',
        );
        await fileManagerFoldersTreeAssertion.assertFolderState(
          'visible',
          folderARenamedName,
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8173: Select folderB in tree, rename it from tree context menu, verify updated name in grid and tree',
      async () => {
        await fileManagerFoldersTree.folderNameByPath(folderB).click();
        await fileManagerFoldersTree.openFolderDotsMenu(folderB);
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerFoldersTree
          .getRenameInput()
          .fillInInput(folderBRenamedName);
        await fileManagerGrid.saveRename();
        await fileManagerFoldersTreeAssertion.assertFolderState(
          'visible',
          folderBRenamedName,
        );
      },
    );

    // TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/6483
    await dialTest.step.skip(
      'EPMRTC-8173: After rename it from tree context menu folder stays selected',
      async () => {
        await fileManagerFoldersTreeAssertion.assertFolderSelectedState(
          true,
          folderBRenamedName,
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8174: Select folderC in tree, rename folderARenamedName from tree context menu, verify folderA renamed and folderC stays selected',
      async () => {
        await fileManagerFoldersTree.folderNameByPath(folderC).click();
        const folderAFinalName = GeneratorUtil.randomString(7);
        await fileManagerFoldersTree.openFolderDotsMenu(folderARenamedName);
        await fileManagerGridRowDropdownMenu.selectItem(MenuOptions.rename);
        await fileManagerFoldersTree
          .getRenameInput()
          .fillInInput(folderAFinalName);
        await fileManagerGrid.saveRename();
        await fileManagerFoldersTreeAssertion.assertFolderState(
          'visible',
          folderAFinalName,
        );
        await fileManagerFoldersTreeAssertion.assertFolderSelectedState(
          true,
          folderC,
        );
      },
    );
  },
);

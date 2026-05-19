import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
  MenuOptions,
  UploadMenuOptions,
} from '@/src/testData';
import { StyleValues } from '@/src/ui/domData';
import { GeneratorUtil, filenamePrefix } from '@/src/utils';

dialTest(
  '[Manage attachments] Create new folder.\n' +
    '[Manage attachments] Upload file directly to newly created nested folder',
  async ({
    setTestIds,
    fileManagerPage,
    fileManagerToolbar,
    fileManagerGrid,
    fileManagerGridAssertion,
    fileManagerFoldersTreeAssertion,
  }) => {
    setTestIds('EPMRTC-3295', 'EPMRTC-3048');
    const parentFolderName = GeneratorUtil.randomString(7);
    const childFolderName = GeneratorUtil.randomString(7);

    await dialTest.step(
      'Open "File manager" page, select "New folder" from New dropdown menu and verify new folder name is opened in edit mode',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded({ isGridVisible: false });
        await fileManagerToolbar.getNewButton().click();
        await fileManagerToolbar
          .getNewButtonDropdownMenu()
          .selectItem(MenuOptions.newFolder);
        await fileManagerGridAssertion.assertGridNameCellInputState('visible');
        await fileManagerGridAssertion.assertGridNameCellInputValue(
          'New folder 1',
        );
      },
    );

    await dialTest.step('Set folder name and select it', async () => {
      await fileManagerGrid.setFolderName(parentFolderName);
      await fileManagerGrid.openFolder(parentFolderName, false);
    });

    await dialTest.step(
      'Create a child folder, select it and upload file via New toolbar dropdown menu',
      async () => {
        await fileManagerToolbar.getNewButton().click();
        await fileManagerToolbar
          .getNewButtonDropdownMenu()
          .selectItem(MenuOptions.newFolder);
        await fileManagerGrid.setFolderName(childFolderName);
        await fileManagerGrid.openFolder(childFolderName, false);

        await fileManagerPage.uploadData(
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
      'Verify file is uploaded into child folder, it is checked and highlighted',
      async () => {
        await fileManagerFoldersTreeAssertion.assertFolderState(
          'visible',
          parentFolderName,
          childFolderName,
        );
        await fileManagerFoldersTreeAssertion.assertFolderSelectedState(
          true,
          parentFolderName,
          childFolderName,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/5673
        // await fileManagerGridAssertion.assertGridCheckboxByNameState(
        //   Attachment.sunImageName,
        //   CheckboxState.checked,
        // );
        // await fileManagerGridAssertion.assertGridRowBackgroundColor(
        //   Attachment.sunImageName,
        //   ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer3),
        // );
      },
    );
  },
);

dialTest(
  '[Manage attachments] Tooltip is shown for folder and file names.\n' +
    '[Manage attachments] Upload file directly to "old" folder',
  async ({
    fileApiHelper,
    setTestIds,
    fileManagerPage,
    fileManagerToolbar,
    fileManagerFoldersTreeAssertion,
    fileManagerGridAssertion,
    fileManagerGrid,
    tooltipPortal,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3022', 'EPMRTC-1615');
    const folderName = GeneratorUtil.randomString(255);
    const imageName =
      filenamePrefix + GeneratorUtil.randomString(255 - filenamePrefix.length);

    await dialTest.step('Upload file to some folder', async () => {
      await fileApiHelper.putFileWithCustomName(
        imageName,
        Attachment.longImageName,
        {
          parentPath: folderName,
        },
      );
    });

    await dialTest.step(
      'Open to "File manager" page and verify tooltip with name is shown on hover the folder',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        const folderLocator =
          await fileManagerGrid.goToGridRowByNameCell(folderName);
        await folderLocator.hover();
        await baseAssertion.assertElementState(tooltipPortal, 'visible');
        await baseAssertion.assertElementTextWrap(
          tooltipPortal,
          StyleValues.breakWord,
        );
        await baseAssertion.assertElementText(
          tooltipPortal,
          folderName,
          ExpectedMessages.tooltipContentIsValid,
        );
      },
    );

    await dialTest.step(
      'Open the folder and verify tooltip with name is shown on hover the file',
      async () => {
        await fileManagerGrid.openFolder(folderName);
        const fileLocator =
          await fileManagerGrid.goToGridRowByNameCell(imageName);
        await fileLocator.hover();
        await baseAssertion.assertElementState(tooltipPortal, 'visible');
        await baseAssertion.assertElementTextWrap(
          tooltipPortal,
          StyleValues.breakWord,
        );
        await baseAssertion.assertElementText(
          tooltipPortal,
          imageName,
          ExpectedMessages.tooltipContentIsValid,
        );
      },
    );

    await dialTest.step(
      'Upload a new file via New toolbar dropdown menu',
      async () => {
        await fileManagerPage.uploadData(
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
      'Verify file is uploaded into existing folder, it is checked and highlighted',
      async () => {
        await fileManagerFoldersTreeAssertion.assertFolderSelectedState(
          true,
          folderName,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/5673
        // await fileManagerGridAssertion.assertGridCheckboxByNameState(
        //   Attachment.sunImageName,
        //   CheckboxState.checked,
        // );
        // await fileManagerGridAssertion.assertGridRowBackgroundColor(
        //   Attachment.sunImageName,
        //   ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer3),
        // );
      },
    );
  },
);

import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { ReplaceConfirmationModalFolders } from '@/src/ui/webElements/replaceConfirmationModalFolders';

export class ReplaceConfirmationModalFoldersAssertion extends FolderAssertion<ReplaceConfirmationModalFolders> {
  constructor(folders: ReplaceConfirmationModalFolders) {
    super(folders);
  }
}

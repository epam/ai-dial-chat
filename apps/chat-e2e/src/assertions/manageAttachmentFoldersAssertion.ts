import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { AttachFilesModal, FileModalSection } from '@/src/ui/webElements';
import { Folders } from '@/src/ui/webElements/entityTree';

export class ManageAttachmentFoldersAssertion extends FolderAssertion<Folders> {
  constructor(attachFilesModal: AttachFilesModal, section: FileModalSection) {
    const folderSection = attachFilesModal.getFoldersTree(section);
    super(folderSection);
  }
}

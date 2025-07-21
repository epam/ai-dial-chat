import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { AttachFilesModal, FileModalSection } from '@/src/ui/webElements';
import { Folders } from '@/src/ui/webElements/entityTree';

export class ManageAttachmentFoldersAssertion extends FolderAssertion<Folders> {
  readonly attachFilesModal: AttachFilesModal;

  constructor(attachFilesModal: AttachFilesModal, section: FileModalSection) {
    const folderSection = AttachFilesModal.getFoldersTree(
      attachFilesModal,
      section,
    );
    super(folderSection);
    this.attachFilesModal = attachFilesModal;
  }
}

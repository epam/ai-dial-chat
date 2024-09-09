import { ModalState } from '@/src/types/modal';

import Modal from '../../Common/Modal';
import { ApplicationDetailsContent } from './Content';
import { ApplicationDetailsFooter } from './Footer';
import { ApplicationDetailsHeader } from './Header';

const appHeader = {
  tags: ['Development', 'SQL'],
  title: 'DIAL RAG',
  avatar: 'https://i.pravatar.cc/300?img=5',
};

const appDetails = {
  previewImages: [
    'https://i.pravatar.cc/900?img=4',
    'https://i.pravatar.cc/900?img=2',
    'https://i.pravatar.cc/900?img=1',
    'https://i.pravatar.cc/900?img=11',
    'https://i.pravatar.cc/900?img=8',
  ],
  capabilities: ['Conversations', 'Document Analysis', 'Browsing'],
  rating: {
    5: 44,
    4: 12,
    3: 7,
    2: 5,
    1: 1,
  },
  releaseDate: '04.05.2024',
  version: '2.2.0',
  author: {
    name: 'Leslie Alexander',
    avatarUrl: 'https://i.pravatar.cc/300?img=5',
  },
  description:
    'The Dial RAG answers user questions using information from the documents provided by user. It supports the following document formats: PDF, DOC/DOCX, PPT/PPTX, TXT and other plain text formats such as code files.',
};

interface Props {
  onClose: () => void;
}

const ApplicationDetails = ({ onClose }: Props) => {
  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa=""
      hideClose
      containerClassName="m-auto flex size-full grow flex-col gap-4 divide-tertiary overflow-y-auto md:grow-0 md:max-w-[700px] xl:max-w-[720px] max-w-[328px]"
      onClose={onClose}
    >
      <div className="flex max-h-full flex-col divide-y divide-tertiary">
        <ApplicationDetailsHeader application={appHeader} />
        <ApplicationDetailsContent application={appDetails} />
        <ApplicationDetailsFooter />
      </div>
    </Modal>
  );
};

export default ApplicationDetails;

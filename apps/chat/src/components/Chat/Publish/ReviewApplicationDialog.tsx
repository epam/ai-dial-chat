import { IconBulb } from '@tabler/icons-react';

import { ApiUtils } from '@/src/utils/server/api';

import { ModalState } from '@/src/types/modal';

import { applicationSelectors } from '@/src/store/application/application.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

import Modal from '../../Common/Modal';
import { Spinner } from '../../Common/Spinner';
import { PublicationControls } from './PublicationChatControls';

export function ReviewApplicationDialog() {
  const application = useAppSelector(applicationSelectors.applicationDetail);
  const isLoading = useAppSelector(applicationSelectors.isLoading);
  const dispatch = useAppDispatch();

  const handleClose = () => {
    dispatch(PublicationActions.setIsApplicationReview(false));
  };

  return (
    <Modal
      dataQa="models-dialog"
      portalId="chat"
      onClose={handleClose}
      overlayClassName="fixed inset-0 top-[48px]"
      state={ModalState.OPENED}
      containerClassName="flex flex-col gap-4 sm:w-[600px] w-full"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      {isLoading ? (
        <div className="flex flex-col justify-center h-[250px]">
          <Spinner className="mx-auto" size={30} />
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-auto px-3 py-4 text-sm md:p-6">
          <div className="flex justify-between">
            <h2 className="text-base font-semibold">Application</h2>
          </div>
          <div className="flex gap-4">
            <span className="w-[122px] text-secondary">Name:</span>
            <span className="max-w-[414px] text-primary">
              {application?.display_name}
            </span>
          </div>
          <div className="flex gap-4">
            <span className="w-[122px] text-secondary">Version:</span>
            <span className="max-w-[414px] text-primary">
              {application?.display_version}
            </span>
          </div>
          <div className="flex gap-4">
            <span className="w-[122px] text-secondary">Icon:</span>
            <IconBulb size={18} className="text-secondary" />
          </div>
          {application?.description && (
            <div className="flex gap-4">
              <span className="w-[122px] text-secondary">Description:</span>
              <span className="max-w-[414px] text-primary">
                {application?.description}
              </span>
            </div>
          )}
          {Object.keys(application?.features || {}).length !== 0 && (
            <div className="flex gap-4">
              <span className="w-[122px] text-secondary">Features data:</span>
              <div className="flex flex-col justify-start">
                {'{'}
                <pre className="flex max-w-[414px] flex-wrap leading-5 text-primary">
                  <br />
                  {Object.keys(application?.features || {}).map((key) => (
                    <>
                      <span>"{key}"</span>:{' '}
                      <span>"{application?.features[key]}"</span>
                      <br />
                    </>
                  ))}
                </pre>
                {'}'}
              </div>
            </div>
          )}
          {application?.input_attachment_types.length !== 0 && (
            <div className="flex gap-4">
              <span className="w-[122px] text-secondary">
                Attachment types:
              </span>
              <div className="flex max-w-[414px] flex-wrap text-primary">
                {application?.input_attachment_types.map((item, index) => (
                  <span
                    key={index}
                    className="m-1 h-[31] items-center justify-between gap-2 rounded bg-accent-primary-alpha px-2 py-1.5"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          {application?.max_input_attachments !== undefined && (
            <div className="flex gap-4">
              <span className="w-[122px] text-secondary">
                Max. attachments number:
              </span>
              <span className="max-w-[414px] text-primary">
                {application?.max_input_attachments}
              </span>
            </div>
          )}
          <div className="flex gap-4">
            <span className="w-[122px] text-secondary">Completion URL:</span>
            <span className="max-w-[414px] text-primary">
              {application?.endpoint}
            </span>
          </div>
        </div>
      )}
      <div className="flex w-full items-center justify-end border-t-[1px] border-tertiary px-3 py-4 md:px-5">
        {!isLoading && application && (
          <PublicationControls
            entity={{
              ...application,
              id: ApiUtils.decodeApiUrl(application.name),
            }}
          />
        )}
      </div>
    </Modal>
  );
}

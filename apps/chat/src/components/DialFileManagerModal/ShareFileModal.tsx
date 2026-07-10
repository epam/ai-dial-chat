import {
  GhostIconButton,
  Input,
  NeutralButton,
  PrimaryButton,
} from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  DialPopup,
  DialRadioGroup,
  RadioGroupOrientation,
} from '@epam/ai-dial-ui-kit';
import type { ShareFilesDtoPermissionEnum } from '@epam/chat-api-client';
import { ShareFilesDtoPermissionEnum as SharePermission } from '@epam/chat-api-client';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { memo, useState, type FC } from 'react';

interface Props {
  targetName: string;
  isSubmitting: boolean;
  getTitle: (name: string) => string;
  readPermissionLabel: string;
  readWritePermissionLabel: string;
  createLinkButtonLabel: string;
  copyLinkButtonLabel: string;
  linkCopiedConfirmation: string;
  cancelLabel: string;
  errorMessage: string;
  onCreateLink: (permission: ShareFilesDtoPermissionEnum) => Promise<string>;
  onClose: () => void;
}

const ShareFileModal: FC<Props> = ({
  targetName,
  isSubmitting,
  getTitle,
  readPermissionLabel,
  readWritePermissionLabel,
  createLinkButtonLabel,
  copyLinkButtonLabel,
  linkCopiedConfirmation,
  cancelLabel,
  errorMessage,
  onCreateLink,
  onClose,
}) => {
  const [permission, setPermission] = useState<ShareFilesDtoPermissionEnum>(
    SharePermission.Read,
  );
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateLink = async (): Promise<void> => {
    setError(null);
    try {
      const link = await onCreateLink(permission);
      setInvitationLink(link);
    } catch {
      setError(errorMessage);
    }
  };

  const handleCopyLink = async (): Promise<void> => {
    if (invitationLink == null) return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing to surface.
    }
  };

  return (
    <DialPopup
      className="!h-fit !max-h-full !w-[400px]"
      open
      dividers={false}
      onClose={onClose}
      header={getTitle(targetName)}
      footer={
        <div className="flex justify-end gap-2 px-6 py-4">
          <NeutralButton label={cancelLabel} onClick={onClose} />
          <PrimaryButton
            label={createLinkButtonLabel}
            onClick={handleCreateLink}
            disabled={isSubmitting}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <DialRadioGroup
          elementId="share-file-permission"
          orientation={RadioGroupOrientation.Column}
          activeRadioButton={permission}
          onChange={(id) => setPermission(id as ShareFilesDtoPermissionEnum)}
          radioButtons={[
            { id: SharePermission.Read, name: readPermissionLabel },
            { id: SharePermission.ReadWrite, name: readWritePermissionLabel },
          ]}
        />

        {error != null && (
          <div role="alert" className="text-sm text-error">
            {error}
          </div>
        )}

        {invitationLink != null && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                id="share-invitation-link"
                value={invitationLink}
                readOnly
              />
            </div>
            <GhostIconButton
              aria-label={copyLinkButtonLabel}
              onClick={handleCopyLink}
              icon={
                isCopied ? (
                  <IconCheck
                    size={DIAL_ICON_SIZE.SM}
                    className="text-success"
                  />
                ) : (
                  <IconCopy size={DIAL_ICON_SIZE.SM} />
                )
              }
            />
            {isCopied && (
              <span role="status" className="sr-only">
                {linkCopiedConfirmation}
              </span>
            )}
          </div>
        )}
      </div>
    </DialPopup>
  );
};

export default memo(ShareFileModal);

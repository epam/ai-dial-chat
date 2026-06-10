import { ChatI18nKeys } from '@/src/constants/i18n';

interface SaveSubmitTooltipArgs {
  isUploadingAttachmentPresent: boolean;
  isContentEmptyAndNoAttachments: boolean;
  isTranscribing?: boolean;
}

export const getSaveSubmitTooltipText = (
  {
    isUploadingAttachmentPresent,
    isContentEmptyAndNoAttachments,
  }: SaveSubmitTooltipArgs,
  t: (key: string) => string,
): string => {
  if (isUploadingAttachmentPresent)
    return t(ChatI18nKeys.WaitForAttachmentToLoad);
  if (isContentEmptyAndNoAttachments) return t(ChatI18nKeys.PleaseTypeMessage);
  return t(ChatI18nKeys.TranscribingAudio);
};

export const isSaveSubmitTooltipHidden = ({
  isUploadingAttachmentPresent,
  isContentEmptyAndNoAttachments,
  isTranscribing,
}: SaveSubmitTooltipArgs): boolean =>
  !isUploadingAttachmentPresent &&
  !isContentEmptyAndNoAttachments &&
  !isTranscribing;

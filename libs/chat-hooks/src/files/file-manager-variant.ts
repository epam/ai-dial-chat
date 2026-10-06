import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '@epam/ai-dial-chat-shared';

export const deriveActionProfile = (
  variant: DialFileManagerVariant,
): DialFileManagerActionProfile => {
  switch (variant) {
    case DialFileManagerVariant.Attach:
      return DialFileManagerActionProfile.Attach;
    case DialFileManagerVariant.Standalone:
      return DialFileManagerActionProfile.Browse;
    case DialFileManagerVariant.FolderPicker:
      return DialFileManagerActionProfile.Full;
  }
};

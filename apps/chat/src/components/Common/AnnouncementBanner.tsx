import { IconSpeakerphone, IconX } from '@tabler/icons-react';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

export const AnnouncementsBanner = () => {
  const dispatch = useAppDispatch();
  const textOfClosedAnnouncement = useAppSelector(
    UISelectors.selectTextOfClosedAnnouncement,
  );
  const announcement = useAppSelector(SettingsSelectors.selectAnnouncement);

  if (
    !announcement ||
    textOfClosedAnnouncement === undefined ||
    textOfClosedAnnouncement === announcement
  ) {
    return null;
  }

  return (
    <div
      className="relative flex items-center justify-center bg-gradient-to-r from-accent-secondary to-accent-tertiary text-controls-permanent"
      data-qa="banner"
    >
      <div className="flex grow items-center justify-center gap-2 py-2 pl-2 pr-8 text-center md:gap-3 md:px-14">
        <IconSpeakerphone size={24} strokeWidth={1.5} className="shrink-0" />
        <span dangerouslySetInnerHTML={{ __html: announcement }}></span>
      </div>
      <button
        className="absolute right-2 top-[calc(50%_-_12px)] shrink-0"
        onClick={() => {
          dispatch(UIActions.closeAnnouncement({ announcement }));
        }}
      >
        <IconX size={24} strokeWidth={1.5} />
      </button>
    </div>
  );
};

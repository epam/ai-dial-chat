import { IconSpeakerphone } from '@tabler/icons-react';
import { useMemo } from 'react';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import chatAnnouncementBanner from '@/public/images/banners/chat-announcement-banner.webp';
import { DialCloseButton } from '@epam/ai-dial-ui-kit';

export const AnnouncementsBanner = () => {
  const dispatch = useAppDispatch();
  const textOfClosedAnnouncement = useAppSelector(
    UISelectors.selectTextOfClosedAnnouncement,
  );
  const announcement = useAppSelector(SettingsSelectors.selectAnnouncement);

  const bannerStyleVariable = useMemo(() => {
    const fallbackBannerSrc = chatAnnouncementBanner.src;
    const tabBannerCssVariableName = '--chat-announcement-banner';

    const bannerCssVariable = `var(${tabBannerCssVariableName}, url(${fallbackBannerSrc}))`;
    return { backgroundImage: bannerCssVariable };
  }, []);

  if (
    !announcement ||
    textOfClosedAnnouncement === undefined ||
    textOfClosedAnnouncement === announcement
  ) {
    return null;
  }

  return (
    <div
      className="relative flex items-center justify-center bg-cover bg-no-repeat text-controls-permanent"
      data-qa="banner"
      style={bannerStyleVariable}
    >
      <div className="flex grow items-center justify-center gap-2 py-2 pl-2 pr-8 text-center md:gap-3 md:px-14">
        <IconSpeakerphone size={24} strokeWidth={1.5} className="shrink-0" />
        <span dangerouslySetInnerHTML={{ __html: announcement }}></span>
      </div>
      <DialCloseButton
        className="absolute right-2 top-[calc(50%_-_12px)] shrink-0 text-controls-permanent"
        onClose={() => {
          dispatch(UIActions.closeAnnouncement({ announcement }));
        }}
      />
    </div>
  );
};

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { withRenderWhen, withRenderWhenFeature } from './RenderWhen';

import { Feature } from '@epam/ai-dial-shared';

const FooterMessageView = () => {
  const footerHtmlMessage = useAppSelector(
    SettingsSelectors.selectFooterHtmlMessage,
  );

  return (
    <div data-qa="footer-message">
      <div className="text-[12px] text-secondary md:text-center">
        <span
          dangerouslySetInnerHTML={{ __html: footerHtmlMessage || '' }}
        ></span>
      </div>
    </div>
  );
};

export const FooterMessage = withRenderWhenFeature(Feature.Footer)(
  withRenderWhen(SettingsSelectors.selectFooterHtmlMessage)(FooterMessageView),
);

import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import {
  IconArrowLeft,
  IconLayoutGrid,
  IconMessagePlus,
} from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  NavigationI18nKeys,
  NotFoundI18nKeys,
} from '../../constants/translation-keys';
import { ROUTES } from '../../types/routes';
import styles from './NotFound.module.scss';

const NotFoundPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section
      aria-label={t(NotFoundI18nKeys.AriaLabel)}
      className={`flex min-h-0 flex-1 flex-col ${styles.root}`}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-10 desktop:px-8">
        <div className="flex w-full max-w-[560px] flex-col items-center text-center">
          <p className="catalog-heading-text mb-3 text-accent-primary">
            {t(NotFoundI18nKeys.Eyebrow)}
          </p>
          <h1 className="dial-h3-text mb-3 text-primary">
            {t(NotFoundI18nKeys.Title)}
          </h1>
          <p className="dial-body-text max-w-[440px] text-secondary">
            {t(NotFoundI18nKeys.Description)}
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 desktop:flex-row desktop:items-center">
            <PrimaryButton
              label={t(NotFoundI18nKeys.OpenCatalog)}
              iconBefore={<IconLayoutGrid size={DIAL_ICON_SIZE.SM} />}
              onClick={() => navigate(ROUTES.Catalog)}
            />
            <NeutralButton
              label={t(NotFoundI18nKeys.NewChat)}
              iconBefore={<IconMessagePlus size={DIAL_ICON_SIZE.SM} />}
              onClick={() => navigate(ROUTES.Root)}
            />
          </div>

          <button
            type="button"
            className="dial-small-text mt-6 inline-flex min-h-11 items-center gap-2 text-secondary hover:text-primary"
            onClick={() => navigate(-1)}
          >
            <IconArrowLeft
              size={DIAL_ICON_SIZE.SM}
              className="rtl:scale-x-[-1]"
              aria-hidden="true"
            />
            {t(NavigationI18nKeys.Back)}
          </button>
        </div>
      </div>
    </section>
  );
};

export default memo(NotFoundPage);

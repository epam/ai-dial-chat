import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GhostButton, NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
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
  ButtonsI18nKeys,
  NavigationI18nKeys,
  NotFoundI18nKeys,
} from '../../constants/translation-keys';
import { ROUTES } from '../../types/routes';
import styles from './NotFound.module.scss';

const NotFoundPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const digitClassName = mergeClasses('relative inline-block', styles.digit);

  return (
    <section
      aria-label={t(NotFoundI18nKeys.Title)}
      className="flex min-h-0 flex-1 flex-col bg-layer-5"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 py-10 desktop:px-8">
        <div
          className={mergeClasses(
            'flex w-full max-w-[560px] flex-col items-center text-center',
            styles.content,
          )}
        >
          <p
            aria-label={t(NotFoundI18nKeys.Eyebrow)}
            className={mergeClasses(
              'relative mb-4 inline-flex items-center justify-center font-bold text-transparent [gap:0.04em]',
              styles.code,
            )}
          >
            <span aria-hidden="true" className={digitClassName}>
              4
            </span>
            <span
              aria-hidden="true"
              className={mergeClasses(digitClassName, styles.zero)}
            >
              0
            </span>
            <span aria-hidden="true" className={digitClassName}>
              4
            </span>
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
              label={t(ButtonsI18nKeys.NewChat)}
              iconBefore={<IconMessagePlus size={DIAL_ICON_SIZE.SM} />}
              onClick={() => navigate(ROUTES.Root)}
            />
          </div>

          <GhostButton
            label={t(NavigationI18nKeys.Back)}
            className="mt-6"
            iconBefore={
              <IconArrowLeft
                size={DIAL_ICON_SIZE.SM}
                className="rtl:scale-x-[-1]"
                aria-hidden="true"
              />
            }
            onClick={() => navigate(-1)}
          />
        </div>
      </div>
    </section>
  );
};

export default memo(NotFoundPage);

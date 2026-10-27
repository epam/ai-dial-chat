import {
  ButtonAppearance,
  ButtonVariant,
  Button,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import { memo, useState, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  CatalogI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useCatalogCreationDecision } from '../../hooks/catalog/useCatalogCreationDecision';
import type { CatalogCreationCheck } from '../../models/catalog-creation';
import { CatalogCreationDecision } from '../../types/catalog-creation';
import { ROUTES } from '../../types/routes';

interface Props extends CatalogCreationCheck {
  /**
   * Whether the editor is creating a new entity. Edit mode renders
   * `children` without consulting the creation policy.
   */
  isCreateMode: boolean;
  children: ReactNode;
}

/*
 * Guards a create-mode editor body: `children` mount only once creation is
 * allowed, so none of the form's effects or submissions run before then.
 * Once mounted the form stays, so a config refetch never discards the user's
 * input; the create flow re-reads `useCatalogCreationDecision` before it
 * dispatches, which is what blocks a permission lost meanwhile.
 */
const RequireCatalogCreation: FC<Props> = ({
  isCreateMode,
  children,
  ...check
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const decision = useCatalogCreationDecision(check);
  const [wasAllowed, setWasAllowed] = useState(false);
  if (
    isCreateMode &&
    decision === CatalogCreationDecision.Allowed &&
    !wasAllowed
  ) {
    setWasAllowed(true);
  }

  if (
    !isCreateMode ||
    wasAllowed ||
    decision === CatalogCreationDecision.Allowed
  ) {
    return children;
  }

  if (decision === CatalogCreationDecision.Pending) {
    const loadingLabel = t(CatalogI18nKeys.CreationLoading);
    /* The kit Spinner is the polite status region and carries the message as
     * its name; the visible copy is hidden from assistive tech so it is not
     * announced twice. */
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
        <Spinner ariaLabel={loadingLabel} />
        <p aria-hidden="true" className="dial-body-text text-primary">
          {loadingLabel}
        </p>
      </div>
    );
  }

  const messageKey =
    decision === CatalogCreationDecision.Denied
      ? CatalogI18nKeys.CreationDenied
      : CatalogI18nKeys.CreationUnavailable;

  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 p-4 text-center">
      <p role="alert" className="dial-body-text text-primary">
        {t(messageKey)}
      </p>
      <Button
        variant={ButtonVariant.Neutral}
        appearance={ButtonAppearance.Outlined}
        label={t(EditorI18nKeys.BackAriaLabel)}
        className="min-h-11"
        iconBefore={
          <IconArrowLeft
            size={DIAL_ICON_SIZE.SM}
            className="rtl:scale-x-[-1]"
            aria-hidden="true"
            stroke={DIAL_KIT_ICON_STROKE}
          />
        }
        onClick={() => navigate(ROUTES.Catalog)}
      />
    </div>
  );
};

export default memo(RequireCatalogCreation);

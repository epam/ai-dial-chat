import { render, screen } from '@testing-library/react';
import i18next, { type i18n as I18n } from 'i18next';
import { I18nextProvider, initReactI18next, Trans } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import en from '../../i18n/locales/en.json';
import { CONFIRMATION_BOLD_COMPONENTS } from '../confirmation-copy';
import {
  CatalogI18nKeys,
  ConversationPanelI18nKeys,
} from '../translation-keys';

/*
 * The app's test setup mocks `Trans` into a component that renders its
 * `i18nKey`, which is what every other spec asserts against. This file is
 * about the opposite: that the real `Trans` turns the `<bold>` tag inside the
 * shipped English strings into the element `CONFIRMATION_BOLD_COMPONENTS`
 * maps it to. Both halves of that pairing are imported from production here —
 * a test that restated either one would keep passing while the app renders the
 * resource name unemphasised, or drops it.
 */
vi.unmock('react-i18next');

const NAME = 'Weekly digest';
const FOLDER = 'Public/Reports';

type ConfirmationCopyKey = CatalogI18nKeys | ConversationPanelI18nKeys;

const CASES: { key: ConfirmationCopyKey; values: Record<string, string> }[] = [
  { key: CatalogI18nKeys.DetailsDeleteConfirmMessage, values: { name: NAME } },
  { key: CatalogI18nKeys.DetailsUnshareConfirmMessage, values: { name: NAME } },
  {
    key: CatalogI18nKeys.DetailsRevokeShareConfirmMessage,
    values: { name: NAME },
  },
  {
    key: CatalogI18nKeys.DetailsUnpublishConfirmMessage,
    values: { name: NAME, folder: FOLDER },
  },
  {
    key: CatalogI18nKeys.DetailsUnpublishSelectFolderMessage,
    values: { name: NAME },
  },
  {
    key: ConversationPanelI18nKeys.DeleteConfirmMessage,
    values: { name: NAME },
  },
];

let i18n: I18n;

beforeAll(async () => {
  i18n = i18next.createInstance();
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  });
});

const renderMessage = (
  key: ConfirmationCopyKey,
  values: Record<string, string>,
) =>
  render(
    <I18nextProvider i18n={i18n}>
      <Trans
        i18nKey={key}
        values={values}
        components={CONFIRMATION_BOLD_COMPONENTS}
      />
    </I18nextProvider>,
  );

describe('confirmation copy', () => {
  it.each(CASES)('emphasises the resource name in $key', ({ key, values }) => {
    const { container } = renderMessage(key, values);

    const emphasised = screen.getByText(NAME);
    expect(emphasised.tagName).toBe('STRONG');
    expect(emphasised.className).toContain('dial-small-semi-text');
    /* A tag the mapping does not cover would survive as literal text. */
    expect(container.textContent).not.toContain('<bold>');
  });

  it('keeps the rest of the delete sentence intact around the name', () => {
    const { container } = renderMessage(
      CatalogI18nKeys.DetailsDeleteConfirmMessage,
      { name: NAME },
    );

    expect(container.textContent).toBe(
      `Are you sure you want to delete ${NAME}? This action is permanent and cannot be undone.`,
    );
  });

  it('leaves the unpublish folder unemphasised, so only the resource stands out', () => {
    renderMessage(CatalogI18nKeys.DetailsUnpublishConfirmMessage, {
      name: NAME,
      folder: FOLDER,
    });

    expect(screen.getByText(new RegExp(FOLDER)).tagName).not.toBe('STRONG');
  });
});

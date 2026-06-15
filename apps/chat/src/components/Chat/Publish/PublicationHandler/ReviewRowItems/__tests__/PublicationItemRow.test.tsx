/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { act, render } from '@testing-library/react';

import { PublicationActions } from '@/src/store/publication/publication.reducers';
import {
  ModelsSelectors,
  PublicationSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { PublicationItemRow } from '../PublicationItemRow';

import { PublishActions } from '@epam/ai-dial-shared';

// ---------------------------------------------------------------------------
// Test ids — mirrors the real naming convention used by DIAL Core:
//   N/A app  : no __version suffix (created via core API without version path)
//   0.0.1 app: __version suffix appended with the pathKeySeparator '__'
// ---------------------------------------------------------------------------
const PUBLICATION_URL = 'publications/public/test-pub-123';
const NA_ID = 'applications/public/custom_app_api/custom_app_api_017';
const VERSIONED_ID =
  'applications/public/custom_app_api/custom_app_api_017__0.0.1';
// Captured from the PublicVersionSelector mock so tests can invoke the
// version-checkbox callback and inspect which props were forwarded.
let capturedOnSelectCheckboxVersion: ((id: string) => void) | undefined;
let capturedSelectedCheckboxVersionIds: string[] | undefined;

const mockDispatch = vi.fn();

const { mockT } = vi.hoisted(() => ({
  mockT: (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Module mocks
// vi.mock factories are hoisted to the top of the file by Vitest, so they
// cannot reference module-scope let/const variables.  Return values that
// depend on our test constants are set in beforeEach via vi.mocked().
// ---------------------------------------------------------------------------
vi.mock('react-hook-form', () => ({
  useWatch: vi.fn().mockReturnValue('public'),
}));

vi.mock('next/router', () => ({
  useRouter: vi.fn().mockReturnValue({
    locale: 'en',
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/src/hooks/usePublicVersionGroupIdFromPublicEntity', () => ({
  // The value must be a non-empty string so PublicVersionSelector renders.
  usePublicVersionGroupId: vi.fn().mockReturnValue('custom_app_api_group'),
}));

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('@/src/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  // Each selector is called with an empty state object; the selectors
  // themselves are mocked below to return fixed values regardless of args.
  useAppSelector: (selector: any) => selector({}),
}));

// All selector functions are stubbed as vi.fn(); return values are
// configured in beforeEach so the test-constant references work correctly.
vi.mock('@/src/store/selectors', () => ({
  PublicationSelectors: {
    selectPublishModel: vi.fn(),
    selectIsEditMode: vi.fn(),
    selectEntityEditStateByReviewUrl: vi.fn(),
    selectPublicVersionGroups: vi.fn(),
    selectSelectedPublicationItems: vi.fn(),
    selectPublicVersionGroupById: vi.fn(),
    selectSelectedCredentialsItems: vi.fn(),
    selectEntitiesEditState: vi.fn(),
  },
  ModelsSelectors: {
    selectModelsVersionGroupByGroupId: vi.fn(),
  },
  ToolsetSelectors: {
    selectToolsetVersionGroupByGroupId: vi.fn(),
  },
}));

vi.mock('@/src/components/Chat/Publish/PublicVersionSelector', () => ({
  PublicVersionSelector: (props: any) => {
    // Capture the callback and selection list for assertion.
    capturedOnSelectCheckboxVersion = props.onSelectCheckboxVersion;
    capturedSelectedCheckboxVersionIds = props.selectedCheckboxVersionIds;
    return <div data-testid="version-selector" />;
  },
}));

vi.mock('@/src/components/Common/Checkbox', () => ({
  Checkbox: ({ onChange }: any) => (
    <input type="checkbox" onChange={onChange} />
  ),
}));

vi.mock('@/src/components/Common/EditableField', () => ({
  EditableField: ({ value }: any) => <span>{value}</span>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeDeleteItem = (id: string, version: string) => ({
  id,
  name: 'custom_app_api_017',
  folderId: 'applications/public/custom_app_api',
  publicationInfo: {
    action: PublishActions.DELETE,
    version,
    isNotExist: false,
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PublicationItemRow – handleSelectCheckboxVersion with N/A versions', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    capturedOnSelectCheckboxVersion = undefined;
    capturedSelectedCheckboxVersionIds = undefined;

    // Configure selector return values (these reference test constants, which
    // is why they live in beforeEach rather than the vi.mock factory).
    (PublicationSelectors.selectPublishModel as any).mockReturnValue(undefined);
    (PublicationSelectors.selectIsEditMode as any).mockReturnValue(false);
    (
      PublicationSelectors.selectEntityEditStateByReviewUrl as any
    ).mockReturnValue(undefined);
    (PublicationSelectors.selectPublicVersionGroups as any).mockReturnValue({});
    // Default: N/A version is the one initially chosen when the modal opened.
    (
      PublicationSelectors.selectSelectedPublicationItems as any
    ).mockReturnValue([NA_ID]);
    (PublicationSelectors.selectPublicVersionGroupById as any).mockReturnValue({
      selectedVersion: { id: NA_ID, version: 'N/A' },
      allVersions: [
        { id: NA_ID, version: 'N/A' },
        { id: VERSIONED_ID, version: '0.0.1' },
      ],
    });
    (
      PublicationSelectors.selectSelectedCredentialsItems as any
    ).mockReturnValue([]);
    (PublicationSelectors.selectEntitiesEditState as any).mockReturnValue({});
    (ModelsSelectors.selectModelsVersionGroupByGroupId as any).mockReturnValue(
      [],
    );
    (
      ToolsetSelectors.selectToolsetVersionGroupByGroupId as any
    ).mockReturnValue([]);
  });

  it('Case 1: dispatches the real versioned id when the base item is N/A and user ticks the versioned checkbox', () => {
    // The N/A version was selected when the modal was opened.
    render(
      <PublicationItemRow
        level={0}
        Icon={<span />}
        item={makeDeleteItem(NA_ID, 'N/A') as any}
        dataQa="test"
        itemTypeName={'application' as any}
        publicationUrl={PUBLICATION_URL}
      />,
    );

    // Simulate the user clicking the 0.0.1 version checkbox.
    // PublicVersionSelector passes the real entity id to the callback.
    act(() => {
      capturedOnSelectCheckboxVersion?.(VERSIONED_ID);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      PublicationActions.selectPublicationItems({
        publicationUrl: PUBLICATION_URL,
        ids: [VERSIONED_ID],
      }),
    );
  });

  it('Case 2: dispatches the real N/A id (no __N/A suffix) when the base item is versioned and user ticks the N/A checkbox', () => {
    // The versioned item was selected when the modal was opened.
    (
      PublicationSelectors.selectSelectedPublicationItems as any
    ).mockReturnValue([VERSIONED_ID]);

    render(
      <PublicationItemRow
        level={0}
        Icon={<span />}
        item={makeDeleteItem(VERSIONED_ID, '0.0.1') as any}
        dataQa="test"
        itemTypeName={'application' as any}
        publicationUrl={PUBLICATION_URL}
      />,
    );

    // Simulate the user clicking the N/A version checkbox.
    act(() => {
      capturedOnSelectCheckboxVersion?.(NA_ID);
    });

    // Must dispatch the real N/A id — NOT a fabricated '…__N/A' url.
    expect(mockDispatch).toHaveBeenCalledWith(
      PublicationActions.selectPublicationItems({
        publicationUrl: PUBLICATION_URL,
        ids: [NA_ID],
      }),
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(
      PublicationActions.selectPublicationItems({
        publicationUrl: PUBLICATION_URL,
        ids: [`${NA_ID}__N/A`],
      }),
    );
  });

  it('Case 2 checkbox state: selectedCheckboxVersionIds contains the plain N/A id so the checkbox renders as checked', () => {
    // selectedPublicationItems contains the real N/A id (no suffix).
    // Verify the prop passed to PublicVersionSelector reflects it so that
    // the N/A checkbox renders as checked (selectedCheckboxVersionIds.includes(NA_ID) === true).
    render(
      <PublicationItemRow
        level={0}
        Icon={<span />}
        item={makeDeleteItem(VERSIONED_ID, '0.0.1') as any}
        dataQa="test"
        itemTypeName={'application' as any}
        publicationUrl={PUBLICATION_URL}
      />,
    );

    // getIdWithoutVersionFromApiKey(VERSIONED_ID) strips '__0.0.1' → NA_ID.
    // So itemVersionsSelected = [NA_ID].filter(id => id.startsWith(NA_ID)) = [NA_ID].
    expect(capturedSelectedCheckboxVersionIds).toContain(NA_ID);
    // Crucially: the fabricated id with __N/A suffix must NOT appear.
    expect(capturedSelectedCheckboxVersionIds).not.toContain(`${NA_ID}__N/A`);
  });
});

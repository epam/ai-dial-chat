/*
 * Guard tests for this package's public `dial-*` class contract — see the
 * "Public class names" section of openspec/lib-styling-guide.md.
 *
 * A styling hook sits on an unlabeled wrapper with no accessible role or text
 * of its own, so asserting one is inherently a DOM-level check and Testing
 * Library has no semantic equivalent of "is this class on that element's
 * ancestor". Every test still locates a real element by role, label or text
 * first and only then walks to the container under test, so a class landing on
 * the wrong node fails rather than passes. Hence the rule exemption below.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import type { DeploymentItem, ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONVERSATION_INPUT_CLASS } from '../../../constants/public-class-names';
import { Input } from '../Input';

const { mockUseIsMobile } = vi.hoisted(() => ({
  mockUseIsMobile: vi.fn(() => false),
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: mockUseIsMobile };
});

const makeDeployments = (): DeploymentItem[] => [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
];

const makeTools = (): ToolMenuItem[] => [
  { id: 'web-search', label: 'Web search', icon: null, isSelected: false },
];

/*
 * The public classes are host styling hooks, so a test must never find an
 * element *by* the class — that would still pass with the class on the wrong
 * node. Locate by role or label first, then walk up to the container under
 * test and assert the hook is on it.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  from.closest(`.${className}`);

describe('Input — public class names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it('marks the composer root with the wrapper class', () => {
    render(<Input />);

    expect(
      closestWithClass(
        screen.getByRole('textbox'),
        CONVERSATION_INPUT_CLASS.wrapper,
      ),
    ).toBeTruthy();
  });

  it('keeps a caller-supplied className alongside the wrapper class', () => {
    render(<Input className="host-root" />);

    const root = closestWithClass(
      screen.getByRole('textbox'),
      CONVERSATION_INPUT_CLASS.wrapper,
    );

    expect(root).toBeTruthy();
    expect(root!.classList.contains('host-root')).toBe(true);
  });

  it('marks the action row and the textarea cell inside it', () => {
    render(<Input />);

    const textareaCell = closestWithClass(
      screen.getByRole('textbox'),
      CONVERSATION_INPUT_CLASS.textareaWrap,
    );

    expect(textareaCell).toBeTruthy();
    expect(
      closestWithClass(textareaCell!, CONVERSATION_INPUT_CLASS.actionRow),
    ).toBeTruthy();
  });

  it('marks the add-attachment cluster', () => {
    render(<Input />);

    expect(
      closestWithClass(
        screen.getByLabelText('Add'),
        CONVERSATION_INPUT_CLASS.addCluster,
      ),
    ).toBeTruthy();
  });

  it('marks the tool chips cell', () => {
    render(<Input toolsMenuItems={makeTools()} onToolToggle={vi.fn()} />);

    const chipsCell = closestWithClass(
      screen.getByRole('button', { name: 'Web search' }),
      CONVERSATION_INPUT_CLASS.toolsChips,
    );

    expect(chipsCell).toBeTruthy();
    expect(
      closestWithClass(chipsCell!, CONVERSATION_INPUT_CLASS.actionRow),
    ).toBeTruthy();
  });

  it('omits the tool chips cell when no tools are shown', () => {
    const { container } = render(<Input />);

    expect(
      container.querySelectorAll(`.${CONVERSATION_INPUT_CLASS.toolsChips}`),
    ).toHaveLength(0);
  });

  it('marks the footer actions cluster', () => {
    render(<Input sendLabel="Send" />);

    expect(
      closestWithClass(
        screen.getByLabelText('Send'),
        CONVERSATION_INPUT_CLASS.footerActions,
      ),
    ).toBeTruthy();
  });

  it('omits the action row when the action bar is hidden', () => {
    const { container } = render(<Input hideActionBar />);

    expect(
      container.querySelectorAll(`.${CONVERSATION_INPUT_CLASS.actionRow}`),
    ).toHaveLength(0);
  });

  it('omits the add cluster when the add button is hidden', () => {
    const { container } = render(<Input hideAddButton />);

    expect(
      container.querySelectorAll(`.${CONVERSATION_INPUT_CLASS.addCluster}`),
    ).toHaveLength(0);
  });

  it('marks the model selector trigger on desktop', () => {
    render(
      <Input
        deployments={makeDeployments()}
        selectedDeploymentId="gpt-4o"
        modelSelectorLabels={{ ariaLabel: 'Select model' }}
      />,
    );

    expect(
      screen
        .getByLabelText(/Select model/)
        .classList.contains(CONVERSATION_INPUT_CLASS.modelSelectorButton),
    ).toBe(true);
  });

  it('marks the model selector trigger on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <Input
        deployments={makeDeployments()}
        selectedDeploymentId="gpt-4o"
        modelSelectorLabels={{ ariaLabel: 'Select model' }}
      />,
    );

    expect(
      screen
        .getByLabelText(/Select model/)
        .classList.contains(CONVERSATION_INPUT_CLASS.modelSelectorButton),
    ).toBe(true);
  });

  it('emits the same classes under rtl as under ltr', () => {
    const readClasses = (): string[] => {
      const root = closestWithClass(
        screen.getByRole('textbox'),
        CONVERSATION_INPUT_CLASS.wrapper,
      );
      return Array.from(root!.classList).filter((name) =>
        name.startsWith('dial-ci-'),
      );
    };

    const view = render(<Input />);
    const ltrClasses = readClasses();
    view.unmount();

    document.documentElement.dir = 'rtl';
    try {
      render(<Input />);
      expect(readClasses()).toEqual(ltrClasses);
    } finally {
      document.documentElement.dir = 'ltr';
    }
  });
});

describe('Input — attachment tray style forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  const attachment = {
    id: 'report',
    name: 'report.pdf',
    file: new File([], 'report.pdf', { type: 'application/pdf' }),
    type: AttachmentType.File,
    contentType: 'application/pdf',
    url: 'files/report.pdf',
    status: RequestStatus.Idle,
  };

  it('forwards the tray class onto the tray found by its role', () => {
    render(
      <Input
        initialAttachments={[attachment]}
        attachmentTray={{ className: 'host-tray' }}
      />,
    );

    expect(
      screen.getByRole('list', { name: 'Attached files' }).classList,
    ).toContain('host-tray');
  });

  it('forwards the nested card styles onto every tile in the tray', () => {
    render(
      <Input
        initialAttachments={[attachment]}
        attachmentTray={{ card: { className: 'host-tile' } }}
      />,
    );

    expect(
      closestWithClass(screen.getByText('report'), 'host-tile'),
    ).toBeTruthy();
  });
});

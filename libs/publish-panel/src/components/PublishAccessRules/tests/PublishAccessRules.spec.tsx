import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  PublicationRule,
  PublicationRuleFunction,
} from '../../../models/publish';
import { PublishAccessRules } from '../PublishAccessRules';

const isDisabled = (element: Element): boolean =>
  (element as HTMLButtonElement).disabled === true;

const mockRule: PublicationRule = {
  source: 'role',
  function: PublicationRuleFunction.Contain,
  targets: ['engineering'],
};

vi.mock('../../PublishAccessRuleEditor/PublishAccessRuleEditor', () => ({
  PublishAccessRuleEditor: ({
    onSave,
    onCancel,
  }: {
    onSave: (rule: PublicationRule) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button onClick={() => onSave(mockRule)}>Save mock rule</button>
      <button onClick={onCancel}>Cancel editor</button>
    </div>
  ),
}));

const existingRule: PublicationRule = {
  source: 'title',
  function: PublicationRuleFunction.Equal,
  targets: ['Internal Tools'],
};

const buildRules = (count: number): PublicationRule[] =>
  Array.from({ length: count }, (_, i) => ({
    source: 'role',
    function: PublicationRuleFunction.Contain,
    targets: [`team-${i}`],
  }));

const renderRules = (
  props?: Partial<Parameters<typeof PublishAccessRules>[0]>,
) => {
  const onRulesChange = vi.fn();
  const utils = render(
    <PublishAccessRules
      rules={[]}
      onRulesChange={onRulesChange}
      sourceOptions={['title', 'role']}
      {...props}
    />,
  );
  return { onRulesChange, ...utils };
};

describe('PublishAccessRules', () => {
  it('renders no "Clear all" control with zero rules', () => {
    renderRules();
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });

  it('renders existing rules as chips with source, function label, and joined targets', () => {
    renderRules({
      rules: [
        {
          source: 'role',
          function: PublicationRuleFunction.Contain,
          targets: ['engineering', 'support'],
        },
      ],
    });
    expect(screen.getByText(/engineering Or support/)).toBeTruthy();
  });

  it('adds a rule and announces it via the live region', async () => {
    const { onRulesChange } = renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Save mock rule' }),
    );

    expect(onRulesChange).toHaveBeenCalledWith([mockRule]);
    expect(screen.getByRole('status').textContent).toBe('Rule added.');
  });

  it('removes one rule via its chip control, keeping the others', async () => {
    const rules: PublicationRule[] = [
      existingRule,
      mockRule,
      {
        source: 'dial_roles',
        function: PublicationRuleFunction.Regex,
        targets: ['^eng-.*$'],
      },
    ];
    const { onRulesChange } = renderRules({ rules });

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove rule for role: engineering',
      }),
    );

    expect(onRulesChange).toHaveBeenCalledWith([rules[0], rules[2]]);
    expect(screen.getByRole('status').textContent).toBe('Rule removed.');
  });

  it('clears every rule via "Clear all"', async () => {
    const { onRulesChange } = renderRules({ rules: [existingRule, mockRule] });

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(onRulesChange).toHaveBeenCalledWith([]);
    expect(screen.getByRole('status').textContent).toBe('All rules cleared.');
  });

  it('disables every control when disabled is true', () => {
    renderRules({ rules: [existingRule], disabled: true });
    expect(isDisabled(screen.getByRole('button', { name: 'Add rule' }))).toBe(
      true,
    );
    expect(isDisabled(screen.getByRole('button', { name: 'Clear all' }))).toBe(
      true,
    );
    expect(
      isDisabled(screen.getByRole('button', { name: /Remove rule for title/ })),
    ).toBe(true);
  });

  it('blocks adding a 21st rule', () => {
    renderRules({ rules: buildRules(20) });

    expect(isDisabled(screen.getByRole('button', { name: 'Add rule' }))).toBe(
      true,
    );
  });

  it('explains why "Add rule" is disabled once the rule limit is reached', () => {
    renderRules({ rules: buildRules(20) });

    expect(
      screen.getByText(
        'Rule limit reached (20). Remove a rule to add another.',
      ),
    ).toBeTruthy();
  });

  it('shows no rule-limit hint while more rules can still be added', () => {
    renderRules({ rules: buildRules(19) });

    expect(screen.queryByText(/Rule limit reached/)).toBeNull();
  });

  it('styles "Clear all" with the primary ghost appearance so its active state is distinguishable', () => {
    renderRules({ rules: [existingRule] });

    expect(
      screen
        .getByRole('button', { name: 'Clear all' })
        .classList.contains('dial-kit-primary-ghost-button'),
    ).toBe(true);
  });

  it('shows a non-blocking loading indicator without disabling Add rule', () => {
    renderRules({ isLoading: true });
    expect(screen.getByText('Loading existing rules…')).toBeTruthy();
    expect(isDisabled(screen.getByRole('button', { name: 'Add rule' }))).toBe(
      false,
    );
  });

  it('shows a non-blocking error notice without disabling Add rule', () => {
    renderRules({ hasLoadError: true });
    expect(
      screen.getByText(/Couldn't load existing rules for this folder/),
    ).toBeTruthy();
    expect(isDisabled(screen.getByRole('button', { name: 'Add rule' }))).toBe(
      false,
    );
  });

  it('announces that existing rules were loaded when isLoading transitions to false with a non-empty result', () => {
    const { rerender } = render(
      <PublishAccessRules
        rules={[]}
        onRulesChange={vi.fn()}
        sourceOptions={[]}
        isLoading
      />,
    );

    rerender(
      <PublishAccessRules
        rules={[existingRule]}
        onRulesChange={vi.fn()}
        sourceOptions={[]}
        isLoading={false}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe(
      'Existing rules loaded for the selected folder.',
    );
  });

  describe('destination-folder scope', () => {
    it('names the folder the rules apply to when one is selected', () => {
      renderRules({ folderName: 'Published models' });

      expect(
        screen.getByText(/These rules apply to "Published models"/),
      ).toBeTruthy();
    });

    it('points the user at the folder picker when no folder is selected', () => {
      renderRules();

      expect(
        screen.getByText(
          'Access rules apply to the destination folder — pick a folder above to set its rules.',
        ),
      ).toBeTruthy();
    });

    it('warns that existing rules have no destination while no folder is selected', () => {
      renderRules({ rules: [existingRule] });

      expect(
        screen.getByText(
          'These rules have no destination yet. Select a folder above to apply them.',
        ),
      ).toBeTruthy();
    });

    it('drops the no-destination warning once a folder is selected', () => {
      renderRules({ rules: [existingRule], folderName: 'Shared' });

      expect(screen.queryByText(/have no destination yet/)).toBeNull();
    });

    it('exposes the section as a group named by its heading', () => {
      renderRules();

      expect(
        screen.getByRole('group', { name: 'Allow access if all match' }),
      ).toBeTruthy();
    });
  });

  it('cancelling the editor does not add a rule', async () => {
    const { onRulesChange } = renderRules();
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel editor' }),
    );

    expect(onRulesChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save mock rule' })).toBeNull();
  });

  it('every chip remove control is keyboard-operable', async () => {
    const { onRulesChange } = renderRules({ rules: [existingRule] });
    const removeButton = screen.getByRole('button', {
      name: /Remove rule for title/,
    });
    removeButton.focus();
    await userEvent.keyboard('{Enter}');

    expect(onRulesChange).toHaveBeenCalledWith([]);
  });

  it('returns focus to the "Add rule" trigger after saving a rule', async () => {
    renderRules();
    const addRuleButton = screen.getByRole('button', { name: 'Add rule' });
    await userEvent.click(addRuleButton);
    await userEvent.click(
      screen.getByRole('button', { name: 'Save mock rule' }),
    );

    expect(addRuleButton.matches(':focus')).toBe(true);
  });

  it('returns focus to the "Add rule" trigger after cancelling the editor', async () => {
    renderRules();
    const addRuleButton = screen.getByRole('button', { name: 'Add rule' });
    await userEvent.click(addRuleButton);
    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel editor' }),
    );

    expect(addRuleButton.matches(':focus')).toBe(true);
  });
});

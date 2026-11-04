import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderFormActionsOrder } from '../../../models/builder-form-actions-order';
import { BuilderFormActions } from '../BuilderFormActions';

const labels = { cancelButtonLabel: 'Cancel', submitButtonLabel: 'Create' };

const renderActions = (order?: BuilderFormActionsOrder) =>
  render(
    <BuilderFormActions
      labels={labels}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      order={order}
    />,
  );

const getButtonNames = () =>
  screen.getAllByRole('button').map((button) => button.textContent);

describe('BuilderFormActions', () => {
  it('lists Cancel before Submit by default', () => {
    renderActions();
    expect(getButtonNames()).toEqual(['Cancel', 'Create']);
  });

  it('lists Submit before Cancel with the SubmitFirst order', () => {
    renderActions(BuilderFormActionsOrder.SubmitFirst);
    expect(getButtonNames()).toEqual(['Create', 'Cancel']);
  });
});

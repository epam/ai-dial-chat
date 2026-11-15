import {
  ResponseError,
  ShareInvitationErrorCode,
  type AcceptInvitationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseAcceptShareInvitationOptions } from '../models';
import { AcceptShareInvitationErrorKind } from '../types';
import { useAcceptShareInvitation } from '../useAcceptShareInvitation/useAcceptShareInvitation';

describe('useAcceptShareInvitation', () => {
  const acceptInvitation =
    vi.fn<(id: string) => Promise<AcceptInvitationResponseDto>>();
  const refreshLists = vi.fn();
  const onSharedItem = vi.fn();
  const onSharedSkill = vi.fn();
  const onAccepted = vi.fn();
  const onError = vi.fn();

  const renderAccept = (
    overrides: Partial<UseAcceptShareInvitationOptions> = {},
  ) =>
    renderHook(
      (props: Partial<UseAcceptShareInvitationOptions>) =>
        useAcceptShareInvitation({
          invitationId: 'abc123',
          acceptInvitation,
          refreshLists,
          onSharedItem,
          onSharedSkill,
          onAccepted,
          onError,
          ...props,
        }),
      { initialProps: overrides },
    );

  beforeEach(() => {
    vi.clearAllMocks();
    refreshLists.mockResolvedValue(undefined);
  });

  it('accepts the invitation and calls onAccepted with the response', async () => {
    const response = { itemId: 'gpt-4o' };
    acceptInvitation.mockResolvedValue(response);

    renderAccept();

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(response));
    expect(acceptInvitation).toHaveBeenCalledWith('abc123');
    expect(refreshLists).toHaveBeenCalledWith(response);
    expect(onSharedItem).not.toHaveBeenCalled();
    expect(onSharedSkill).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('does nothing while the invitation id is missing', () => {
    renderAccept({ invitationId: undefined });

    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('accepts only once per mount even when the options change', async () => {
    acceptInvitation.mockResolvedValue({ itemId: 'gpt-4o' });

    const { rerender } = renderAccept();
    rerender({ invitationId: 'other', onAccepted: vi.fn() });

    await waitFor(() => expect(onAccepted).toHaveBeenCalledOnce());
    expect(acceptInvitation).toHaveBeenCalledOnce();
  });

  it('merges the shared deployment and skill after the refresh settles', async () => {
    const sharedDeployment = {
      id: 'gpt-4o',
      displayName: 'GPT-4o',
      type: 'model' as const,
    };
    const sharedSkill = {
      name: 'search',
      path: 'search',
      url: 'skills/b/search',
      bucket: 'b',
      nodeType: 'item' as const,
    };
    acceptInvitation.mockResolvedValue({
      itemId: 'gpt-4o',
      sharedDeployment,
      sharedSkill,
    } as AcceptInvitationResponseDto);

    renderAccept();

    await waitFor(() => expect(onAccepted).toHaveBeenCalledOnce());
    expect(onSharedItem).toHaveBeenCalledWith(sharedDeployment);
    expect(onSharedSkill).toHaveBeenCalledWith(sharedSkill);
    const refreshOrder = refreshLists.mock.invocationCallOrder[0];
    expect(refreshOrder).toBeLessThan(onSharedItem.mock.invocationCallOrder[0]);
    expect(refreshOrder).toBeLessThan(
      onSharedSkill.mock.invocationCallOrder[0],
    );
    expect(onSharedSkill.mock.invocationCallOrder[0]).toBeLessThan(
      onAccepted.mock.invocationCallOrder[0],
    );
  });

  it('merges the shared toolset when no deployment was resolved', async () => {
    const sharedToolset = {
      id: 'toolsets/b/search__0.0.1',
      toolset: 'toolsets/b/search__0.0.1',
      displayName: 'Search',
    };
    acceptInvitation.mockResolvedValue({
      itemId: 'toolsets/b/search__0.0.1',
      sharedToolset,
    } as AcceptInvitationResponseDto);

    renderAccept();

    await waitFor(() =>
      expect(onSharedItem).toHaveBeenCalledWith(sharedToolset),
    );
  });

  it('skips the refresh when the host passes none', async () => {
    acceptInvitation.mockResolvedValue({ itemId: 'projects/b/q4' });

    renderAccept({ refreshLists: undefined });

    await waitFor(() => expect(onAccepted).toHaveBeenCalledOnce());
    expect(refreshLists).not.toHaveBeenCalled();
  });

  it('reports a classified error and does not call onAccepted when the accept fails', async () => {
    acceptInvitation.mockRejectedValue(
      new ResponseError(
        new Response(
          JSON.stringify({
            statusCode: 404,
            code: ShareInvitationErrorCode.ShareInvitationNotFound,
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    renderAccept({ labels: { notFound: 'expired' } });

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: AcceptShareInvitationErrorKind.NotFound,
          message: 'expired',
        }),
      ),
    );
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('reports a failed refresh as an error', async () => {
    acceptInvitation.mockResolvedValue({ itemId: 'gpt-4o' });
    refreshLists.mockRejectedValue(new Error('refresh failed'));

    renderAccept();

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: AcceptShareInvitationErrorKind.Failed,
          message: 'refresh failed',
        }),
      ),
    );
    expect(onAccepted).not.toHaveBeenCalled();
  });
});

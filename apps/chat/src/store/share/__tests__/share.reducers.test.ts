import { describe, expect, it } from 'vitest';

import { RootState } from '@/src/types/store';

import { ShareActions, shareSlice } from '../share.reducers';
import { ShareSelectors } from '../share.selectors';

const makeRootState = (share: ReturnType<typeof shareSlice.getInitialState>) =>
  ({ share }) as RootState;

describe('share.reducers acceptShareInvitation', () => {
  it('records the invitation id as processed', () => {
    const state = shareSlice.reducer(
      shareSlice.getInitialState(),
      ShareActions.acceptShareInvitation({ invitationId: 'invitation-1' }),
    );

    expect(state.processedInvitationIds).toEqual(['invitation-1']);
  });

  it('does not duplicate an invitation id already processed', () => {
    const action = ShareActions.acceptShareInvitation({
      invitationId: 'invitation-1',
    });

    let state = shareSlice.reducer(shareSlice.getInitialState(), action);
    state = shareSlice.reducer(state, action);

    expect(state.processedInvitationIds).toEqual(['invitation-1']);
  });

  it('tracks distinct invitation ids independently', () => {
    let state = shareSlice.reducer(
      shareSlice.getInitialState(),
      ShareActions.acceptShareInvitation({ invitationId: 'invitation-1' }),
    );
    state = shareSlice.reducer(
      state,
      ShareActions.acceptShareInvitation({ invitationId: 'invitation-2' }),
    );

    expect(state.processedInvitationIds).toEqual([
      'invitation-1',
      'invitation-2',
    ]);
  });
});

describe('share.selectors selectIsInvitationProcessed', () => {
  it('reports whether an invitation was already accepted in this session', () => {
    const state = shareSlice.reducer(
      shareSlice.getInitialState(),
      ShareActions.acceptShareInvitation({ invitationId: 'invitation-1' }),
    );

    expect(
      ShareSelectors.selectIsInvitationProcessed(
        makeRootState(state),
        'invitation-1',
      ),
    ).toBe(true);
    expect(
      ShareSelectors.selectIsInvitationProcessed(
        makeRootState(state),
        'invitation-2',
      ),
    ).toBe(false);
  });
});

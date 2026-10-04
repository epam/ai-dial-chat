import { describe, expect, it } from 'vitest';
import {
  CUSTOM_API_MAX_PRINCIPAL_IN_FLIGHT,
  CUSTOM_API_MAX_TOTAL_IN_FLIGHT,
  CustomApiAdmissionService,
} from '../custom-api-admission.service';

describe('CustomApiAdmissionService', () => {
  it('admits up to the per-principal ceiling and rejects the next call', () => {
    const admission = new CustomApiAdmissionService();

    for (let i = 0; i < CUSTOM_API_MAX_PRINCIPAL_IN_FLIGHT; i += 1) {
      expect(admission.tryAcquire('provider:alice')).toBe(true);
    }
    expect(admission.tryAcquire('provider:alice')).toBe(false);
  });

  it('shares the per-principal ceiling across sessions/operations for the same principal', () => {
    const admission = new CustomApiAdmissionService();

    expect(admission.tryAcquire('provider:alice')).toBe(true);
    expect(admission.tryAcquire('provider:alice')).toBe(true);
    expect(admission.tryAcquire('provider:alice')).toBe(true);
    expect(admission.tryAcquire('provider:alice')).toBe(true);
    // A different session/operation for the same verified principal still
    // shares the same four-call bound.
    expect(admission.tryAcquire('provider:alice')).toBe(false);
  });

  it("does not let one principal exhaust another principal's capacity", () => {
    const admission = new CustomApiAdmissionService();

    for (let i = 0; i < CUSTOM_API_MAX_PRINCIPAL_IN_FLIGHT; i += 1) {
      expect(admission.tryAcquire('provider:alice')).toBe(true);
    }
    expect(admission.tryAcquire('provider:bob')).toBe(true);
  });

  it('enforces the global ceiling across many distinct principals', () => {
    const admission = new CustomApiAdmissionService();
    let admitted = 0;

    for (let i = 0; i < CUSTOM_API_MAX_TOTAL_IN_FLIGHT + 10; i += 1) {
      if (admission.tryAcquire(`provider:user-${i}`)) {
        admitted += 1;
      }
    }

    expect(admitted).toBe(CUSTOM_API_MAX_TOTAL_IN_FLIGHT);
  });

  it('frees capacity on release and removes the principal entry at zero active calls', () => {
    const admission = new CustomApiAdmissionService();

    admission.tryAcquire('provider:alice');
    admission.tryAcquire('provider:alice');
    expect(admission.trackedPrincipalCount).toBe(1);

    admission.release('provider:alice');
    expect(admission.trackedPrincipalCount).toBe(1);

    admission.release('provider:alice');
    expect(admission.trackedPrincipalCount).toBe(0);
    expect(admission.totalInFlightCount).toBe(0);
  });

  it('never creates unbounded state: tracked principals never exceed the global ceiling', () => {
    const admission = new CustomApiAdmissionService();

    for (let i = 0; i < CUSTOM_API_MAX_TOTAL_IN_FLIGHT + 50; i += 1) {
      admission.tryAcquire(`provider:user-${i}`);
    }

    expect(admission.trackedPrincipalCount).toBeLessThanOrEqual(
      CUSTOM_API_MAX_TOTAL_IN_FLIGHT,
    );
  });

  it('does not go negative when release is called without a matching acquire', () => {
    const admission = new CustomApiAdmissionService();

    admission.release('provider:never-acquired');

    expect(admission.totalInFlightCount).toBe(0);
    expect(admission.trackedPrincipalCount).toBe(0);
  });
});

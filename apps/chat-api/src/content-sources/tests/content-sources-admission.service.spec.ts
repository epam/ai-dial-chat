import { describe, expect, it } from 'vitest';
import {
  ContentSourcesAdmissionService,
  ContentSourcesMissLimitException,
} from '../content-sources-admission.service';
import { ContentSourcesRegistryService } from '../content-sources-registry.service';

const LIMIT = 8;

const create = () =>
  new ContentSourcesAdmissionService({
    principalMissConcurrency: LIMIT,
  } as ContentSourcesRegistryService);

describe('ContentSourcesAdmissionService', () => {
  it('refuses the request after the limit for one principal', () => {
    const admission = create();
    const leases = Array.from({ length: LIMIT }, () => admission.lease('a'));
    leases.forEach((lease) => lease.ensure());

    const extra = admission.lease('a');
    expect(() => extra.ensure()).toThrow(ContentSourcesMissLimitException);
    expect(() => extra.ensure()).toThrow(
      'Too many concurrent content-source requests',
    );
  });

  it('counts a lease once however often it is ensured', () => {
    const admission = create();
    const lease = admission.lease('a');
    lease.ensure();
    lease.ensure();
    Array.from({ length: LIMIT - 1 }, () => admission.lease('a')).forEach(
      (other) => other.ensure(),
    );
    expect(() => admission.lease('a').ensure()).toThrow(
      ContentSourcesMissLimitException,
    );
  });

  it('frees the slot on release, once', () => {
    const admission = create();
    const leases = Array.from({ length: LIMIT }, () => admission.lease('a'));
    leases.forEach((lease) => lease.ensure());
    leases[0].release();
    leases[0].release();

    expect(() => admission.lease('a').ensure()).not.toThrow();
    expect(admission.trackedPrincipalCount).toBe(1);
  });

  it('takes nothing for a lease that was never ensured', () => {
    const admission = create();
    const lease = admission.lease('a');
    lease.release();
    expect(admission.trackedPrincipalCount).toBe(0);
  });

  it('treats ensure after release as a no-op', () => {
    const admission = create();
    const lease = admission.lease('a');
    lease.release();
    lease.ensure();
    expect(admission.trackedPrincipalCount).toBe(0);
  });

  it('keeps principals independent', () => {
    const admission = create();
    Array.from({ length: LIMIT }, () => admission.lease('a')).forEach((lease) =>
      lease.ensure(),
    );
    expect(() => admission.lease('b').ensure()).not.toThrow();
    expect(admission.trackedPrincipalCount).toBe(2);
  });
});

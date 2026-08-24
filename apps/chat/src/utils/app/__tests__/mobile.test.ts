import { afterEach, describe, expect, it, vi } from 'vitest';

import { isDesktopDevice, isTouchable } from '@/src/utils/app/mobile';

const USER_AGENTS = {
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  iPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iPad: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

interface DeviceStub {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  coarsePointer: boolean;
}

const stubbedKeys: string[] = [];

const stubDevice = ({
  userAgent,
  platform,
  maxTouchPoints,
  coarsePointer,
}: DeviceStub) => {
  const values = { userAgent, platform, maxTouchPoints };

  (Object.keys(values) as (keyof typeof values)[]).forEach((key) => {
    stubbedKeys.push(key);
    Object.defineProperty(navigator, key, {
      value: values[key],
      configurable: true,
    });
  });

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' && coarsePointer,
      media: query,
    })),
  );
};

afterEach(() => {
  // `navigator` properties are inherited from Navigator.prototype in jsdom, so
  // deleting the own properties added above restores the original getters.
  stubbedKeys.splice(0).forEach((key) => {
    delete (navigator as unknown as Record<string, unknown>)[key];
  });
  vi.unstubAllGlobals();
});

describe('isDesktopDevice', () => {
  const cases: { name: string; device: DeviceStub; expected: boolean }[] = [
    {
      name: 'a desktop without a touch screen',
      device: {
        userAgent: USER_AGENTS.windowsChrome,
        platform: 'Win32',
        maxTouchPoints: 0,
        coarsePointer: false,
      },
      expected: true,
    },
    {
      name: 'a laptop with a touch screen',
      device: {
        userAgent: USER_AGENTS.windowsChrome,
        platform: 'Win32',
        maxTouchPoints: 5,
        coarsePointer: false,
      },
      expected: true,
    },
    {
      name: 'a mac',
      device: {
        userAgent: USER_AGENTS.macSafari,
        platform: 'MacIntel',
        maxTouchPoints: 0,
        coarsePointer: false,
      },
      expected: true,
    },
    {
      name: 'an iPhone',
      device: {
        userAgent: USER_AGENTS.iPhone,
        platform: 'iPhone',
        maxTouchPoints: 5,
        coarsePointer: true,
      },
      expected: false,
    },
    {
      name: 'an android phone',
      device: {
        userAgent: USER_AGENTS.androidPhone,
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
        coarsePointer: true,
      },
      expected: false,
    },
    {
      name: 'an android tablet',
      device: {
        userAgent: USER_AGENTS.androidTablet,
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
        coarsePointer: true,
      },
      expected: false,
    },
    {
      name: 'an iPad',
      device: {
        userAgent: USER_AGENTS.iPad,
        platform: 'iPad',
        maxTouchPoints: 5,
        coarsePointer: true,
      },
      expected: false,
    },
    {
      // the user agent is indistinguishable from a mac here: only
      // `navigator.platform` + `maxTouchPoints` give the iPad away
      name: 'an iPad requesting the desktop site',
      device: {
        userAgent: USER_AGENTS.macSafari,
        platform: 'MacIntel',
        maxTouchPoints: 5,
        coarsePointer: true,
      },
      expected: false,
    },
  ];

  it.each(cases)('returns $expected for $name', ({ device, expected }) => {
    stubDevice(device);

    expect(isDesktopDevice()).toBe(expected);
  });

  it('returns false when there is no user agent', () => {
    stubDevice({
      userAgent: '',
      platform: '',
      maxTouchPoints: 0,
      coarsePointer: false,
    });

    expect(isDesktopDevice()).toBe(false);
  });

  it('reports a touch laptop as both touchable and desktop', () => {
    stubDevice({
      userAgent: USER_AGENTS.windowsChrome,
      platform: 'Win32',
      maxTouchPoints: 5,
      coarsePointer: false,
    });

    expect(isTouchable()).toBe(true);
    expect(isDesktopDevice()).toBe(true);
  });
});

import { isAbsoluteUrl } from '../file';

describe.skip('File utility methods', () => {
  it.each([
    ['http://test.com'],
    ['https://test.com'],
    ['ftp://test.com'],
    ['file://test.com'],
    ['data:some_data'],
  ])('isAbsoluteUrl (%s, %s, %s, %s) returns true', (url) => {
    expect(isAbsoluteUrl(url)).toBe(true);
  });

  it.each([['/test/test1'], ['abc'], ['abc/cde'], ['1/2/3']])(
    'isAbsoluteUrl (%s, %s, %s, %s) returns false',
    (url) => {
      expect(isAbsoluteUrl(url)).toBe(false);
    },
  );
});

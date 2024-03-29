import { decodeModelId, encodeModelId, isUrlAbsolute } from '../api';

describe('decodeModelId and encodeModelId', () => {
  it.each([
    'gpt_4',
    'gpt__4',
    'gpt%5F%5F4',
    `gpt${encodeURI('%5F%5F')}4`,
    'gpt-4',
  ])('decodeModelId(encodeModelId(%s))', (path: string) => {
    expect(decodeModelId(encodeModelId(path))).toBe(path);
  });
});

describe('isUrlAbsolute', () => {
  it('should check if url is absolute', () => {
    expect(isUrlAbsolute('api/conversations/')).toBeFalsy();
    expect(isUrlAbsolute('http://host.com/api')).toBeTruthy();
  });
});

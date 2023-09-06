import { webcrypto } from 'node:crypto';

export class GeneratorUtil {
  static randomIntegerNumber() {
    return Math.floor(Math.random() * 50);
  }

  static randomString(length: number) {
    const chars =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    const randomValues = new Uint8Array(length);
    webcrypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    return result;
  }
}

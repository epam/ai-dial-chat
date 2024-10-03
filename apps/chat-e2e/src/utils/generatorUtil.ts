import { webcrypto } from 'node:crypto';

export class GeneratorUtil {
  static randomIntegerNumber() {
    return Math.floor(Math.random() * 50);
  }

  static randomNumberInRange(range: number) {
    return Math.floor(Math.random() * range);
  }

  static randomArrayElement<T>(array: T[]) {
    const index = this.randomNumberInRange(array.length);
    return array[index];
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

  static randomPublicationRequestName() {
    return 'E2EPublish' + GeneratorUtil.randomString(7);
  }

  static randomUnpublishRequestName() {
    return 'E2EUnpublish' + GeneratorUtil.randomString(7);
  }
}

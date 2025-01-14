import { ExpectedConstants, Import } from '@/src/testData';
import { webcrypto } from 'node:crypto';

export const publicationRequestPrefix = 'E2EPublish';
export const unpublishRequestPrefix = 'E2EUnpublish';

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

  static randomArrayElements<T>(array: T[], count: number): T[] {
    if (count >= array.length) return array.slice();
    if (count <= 0) return [];

    const result: T[] = [];
    const taken = new Set<number>();

    while (result.length < count) {
      const index = Math.floor(Math.random() * array.length);
      if (!taken.has(index)) {
        taken.add(index);
        result.push(array[index]);
      }
    }
    return result;
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
    return publicationRequestPrefix + GeneratorUtil.randomString(7);
  }

  static randomUnpublishRequestName() {
    return unpublishRequestPrefix + GeneratorUtil.randomString(7);
  }

  static exportedWithoutAttachmentsFilename() {
    return `${GeneratorUtil.randomString(7)}${ExpectedConstants.exportedFileExtension}`;
  }

  static exportedWithAttachmentsFilename() {
    return `${GeneratorUtil.randomString(7)}${Import.importAttachmentExtension}`;
  }
}

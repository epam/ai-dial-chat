import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAdditionalCssDir,
  getAdditionalCssFilenames,
  isValidAdditionalCssFilename,
  readAdditionalCssFile,
} from '../additional-css';

import path from 'path';

const { mockReaddirSync, mockReadFileSync } = vi.hoisted(() => ({
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  },
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}));

describe('getAdditionalCssDir', () => {
  beforeEach(() => {
    delete process.env.ADDITIONAL_CSS_DIR;
  });

  it('should use ADDITIONAL_CSS_DIR when set', () => {
    // Arrange
    process.env.ADDITIONAL_CSS_DIR = '/custom/css';

    // Act
    const result = getAdditionalCssDir();

    // Assert
    expect(result).toBe('/custom/css');
  });

  it('should fall back to cwd/additional_css when env var is not set', () => {
    // Act
    const result = getAdditionalCssDir();

    // Assert
    expect(result).toBe(path.join(process.cwd(), 'additional_css'));
  });
});

describe('getAdditionalCssFilenames', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return sorted css filenames when folder exists', () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['zebra.css', 'alpha.css', 'notes.txt']);

    // Act
    const result = getAdditionalCssFilenames('/css');

    // Assert
    expect(result).toEqual(['alpha.css', 'zebra.css']);
    expect(mockReaddirSync).toHaveBeenCalledWith('/css');
  });

  it('should exclude non-css files', () => {
    // Arrange
    mockReaddirSync.mockReturnValue(['styles.css', 'readme.md', 'script.js']);

    // Act
    const result = getAdditionalCssFilenames('/css');

    // Assert
    expect(result).toEqual(['styles.css']);
  });

  it('should return an empty array when folder does not exist', () => {
    // Arrange
    mockReaddirSync.mockImplementation(() => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });

    // Act
    const result = getAdditionalCssFilenames('/missing');

    // Assert
    expect(result).toEqual([]);
  });

  it('should return an empty array when readdirSync throws any error', () => {
    // Arrange
    mockReaddirSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    // Act
    const result = getAdditionalCssFilenames('/restricted');

    // Assert
    expect(result).toEqual([]);
  });
});

describe('isValidAdditionalCssFilename', () => {
  it.each([
    ['custom.css', true],
    ['nested/file.css', false],
    ['..\\secret.css', false],
    ['../secret.css', false],
    ['styles.txt', false],
  ])('isValidAdditionalCssFilename(%s) = %s', (filename, expected) => {
    expect(isValidAdditionalCssFilename(filename)).toBe(expected);
  });
});

describe('readAdditionalCssFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ADDITIONAL_CSS_DIR;
  });

  it('should return file contents for a valid css filename', () => {
    // Arrange
    process.env.ADDITIONAL_CSS_DIR = '/css';
    mockReadFileSync.mockReturnValue('body { color: red; }');

    // Act
    const result = readAdditionalCssFile('custom.css');

    // Assert
    expect(result).toBe('body { color: red; }');
    expect(mockReadFileSync).toHaveBeenCalledWith('/css/custom.css', 'utf-8');
  });

  it('should return null for an invalid filename', () => {
    // Act
    const result = readAdditionalCssFile('../secret.css');

    // Assert
    expect(result).toBeNull();
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('should return null when the file is missing', () => {
    // Arrange
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    // Act
    const result = readAdditionalCssFile('missing.css');

    // Assert
    expect(result).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NextApiRequest, NextApiResponse } from 'next';

import handler from '../[filename]';

const { mockReadAdditionalCssFile, mockIsValidAdditionalCssFilename } =
  vi.hoisted(() => ({
    mockReadAdditionalCssFile: vi.fn(),
    mockIsValidAdditionalCssFilename: vi.fn(),
  }));

vi.mock('@/src/utils/server/additional-css', () => ({
  isValidAdditionalCssFilename: mockIsValidAdditionalCssFilename,
  readAdditionalCssFile: mockReadAdditionalCssFile,
}));

describe('additional-css/[filename] handler', () => {
  const mockSend = vi.fn();
  const mockSetHeader = vi.fn(() => ({ send: mockSend }));
  const mockStatus = vi.fn(() => ({
    send: mockSend,
    setHeader: mockSetHeader,
  }));

  const createResponse = () =>
    ({
      status: mockStatus,
      setHeader: mockSetHeader,
      send: mockSend,
    }) as unknown as NextApiResponse;

  beforeEach(() => {
    vi.resetAllMocks();
    mockIsValidAdditionalCssFilename.mockReturnValue(true);
    mockReadAdditionalCssFile.mockReturnValue('body { color: red; }');
  });

  it('should return css content with text/css content type', () => {
    // Arrange
    const req = {
      query: { filename: 'custom.css' },
    } as unknown as NextApiRequest;
    const res = createResponse();

    // Act
    handler(req, res);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'text/css');
    expect(mockSend).toHaveBeenCalledWith('body { color: red; }');
  });

  it('should return 400 when filename is missing', () => {
    // Arrange
    const req = { query: {} } as unknown as NextApiRequest;
    const res = createResponse();

    // Act
    handler(req, res);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockSend).toHaveBeenCalledWith('Filename not provided');
  });

  it('should return 400 when filename is an array', () => {
    // Arrange
    const req = {
      query: { filename: ['custom.css'] },
    } as unknown as NextApiRequest;
    const res = createResponse();

    // Act
    handler(req, res);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockSend).toHaveBeenCalledWith('Filename not provided');
  });

  it('should return 400 for invalid filenames', () => {
    // Arrange
    mockIsValidAdditionalCssFilename.mockReturnValue(false);
    const req = {
      query: { filename: '../secret.css' },
    } as unknown as NextApiRequest;
    const res = createResponse();

    // Act
    handler(req, res);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockSend).toHaveBeenCalledWith('Invalid filename');
  });

  it('should return 404 when css file is not found', () => {
    // Arrange
    mockReadAdditionalCssFile.mockReturnValue(null);
    const req = {
      query: { filename: 'missing.css' },
    } as unknown as NextApiRequest;
    const res = createResponse();

    // Act
    handler(req, res);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockSend).toHaveBeenCalledWith('CSS file not found');
  });
});

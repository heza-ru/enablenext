const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { FileSources } = require('librechat-data-provider');

jest.mock('~/cache', () => ({
  getLogStores: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}));

// Isolate this unit test from the (unrelated, pre-existing) @librechat/data-schemas
// winston/logger chain, which is currently incompatible with the repo's global
// winston mock (test/__mocks__/logger.js) independent of anything in this route.
jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('~/config', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockSaveBuffer = jest.fn();

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(() => ({ saveBuffer: mockSaveBuffer })),
}));

// Import the router after mocks
const router = require('./deckAsset');

describe('POST /files/images/deck-asset', () => {
  let app;
  let tempDir;
  let currentUser;
  /** Simulated `req.file` for the next request; null means no file was attached. */
  let currentFile;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-asset-test-'));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'user-123' };
    currentFile = null;

    app = express();
    app.use(express.json());

    // Stand in for: requireJwtAuth (sets/omits req.user), configMiddleware (sets req.config),
    // and multer's upload.single('file') (sets req.file from a pre-written temp file).
    app.use((req, res, next) => {
      if (currentUser) {
        req.user = currentUser;
      }
      req.config = { fileStrategy: FileSources.local };
      req.file = currentFile;
      next();
    });

    app.use('/files/images/deck-asset', router);
  });

  const writeTempFile = (name, contents = 'fake-image-bytes') => {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, contents);
    return filePath;
  };

  it('uploads an image and returns a URL', async () => {
    const filePath = writeTempFile('photo.png');
    currentFile = {
      path: filePath,
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: fs.statSync(filePath).size,
    };
    mockSaveBuffer.mockResolvedValue('/images/user-123/generated-name.png');

    const response = await request(app).post('/files/images/deck-asset').send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: '/images/user-123/generated-name.png' });
    expect(mockSaveBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        fileName: expect.stringMatching(/\.png$/),
      }),
    );
    // Temp upload file should be cleaned up
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('rejects non-image mimetypes', async () => {
    const filePath = writeTempFile('doc.pdf');
    currentFile = {
      path: filePath,
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
      size: fs.statSync(filePath).size,
    };

    const response = await request(app).post('/files/images/deck-asset').send();

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Unsupported file type/);
    expect(mockSaveBuffer).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    currentUser = null;
    currentFile = {
      path: writeTempFile('photo2.png'),
      originalname: 'photo2.png',
      mimetype: 'image/png',
      size: 100,
    };

    const response = await request(app).post('/files/images/deck-asset').send();

    expect(response.status).toBe(401);
    expect(mockSaveBuffer).not.toHaveBeenCalled();
  });
});

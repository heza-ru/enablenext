// api/server/routes/__tests__/index.test.js

// Mock all route modules to avoid loading heavy dependencies
jest.mock('../accessPermissions', () => ({}));
jest.mock('../assistants', () => ({}));
jest.mock('../drive', () => ({}));
jest.mock('../categories', () => ({}));
jest.mock('../endpoints', () => ({}));
jest.mock('../static', () => ({}));
jest.mock('../messages', () => ({}));
jest.mock('../memories', () => ({}));
jest.mock('../presets', () => ({}));
jest.mock('../prompts', () => ({}));
jest.mock('../balance', () => ({}));
jest.mock('../actions', () => ({}));
jest.mock('../banner', () => ({}));
jest.mock('../search', () => ({}));
jest.mock('../models', () => ({}));
jest.mock('../convos', () => ({}));
jest.mock('../config', () => ({}));
jest.mock('../agents', () => ({}));
jest.mock('../roles', () => ({}));
jest.mock('../oauth', () => ({}));
jest.mock('../files', () => ({}));
jest.mock('../share', () => ({}));
jest.mock('../tags', () => ({}));
jest.mock('../auth', () => ({}));
jest.mock('../keys', () => ({}));
jest.mock('../user', () => ({}));
jest.mock('../mcp', () => ({}));

const routes = require('../index');

describe('routes/index', () => {
  it('does not export an artifacts route (removed dead Playwright render path)', () => {
    expect(routes.artifacts).toBeUndefined();
  });
});

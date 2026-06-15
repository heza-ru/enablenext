const mongoose = require('mongoose');
const { createMethods } = require('@librechat/data-schemas');
const methods = createMethods(mongoose);
const { comparePassword } = require('./userMethods');
const {
  getMessage,
  getMessages,
  saveMessage,
  recordMessage,
  updateMessage,
  deleteMessagesSince,
  deleteMessages,
} = require('./Message');
const { getConvoTitle, getConvo, saveConvo, deleteConvos } = require('./Conversation');
const { getPreset, getPresets, savePreset, deletePresets } = require('./Preset');
const { File } = require('~/db/models');

const LEGACY_AGENT_IDS = [
  'whatfix-presentation-creator',
  'whatfix-excel-creator',
  'whatfix-doc-creator',
];

const seedDatabase = async () => {
  await methods.initializeRoles();
  await methods.seedDefaultRoles();
  await methods.ensureDefaultCategories();

  // Remove legacy seeded agents that are no longer part of the product
  const { deleteAgent } = require('./Agent');
  for (const id of LEGACY_AGENT_IDS) {
    try {
      const removed = await deleteAgent({ id });
      if (removed) {
        const { logger } = require('@librechat/data-schemas');
        logger.info(`[seedDatabase] Removed legacy agent: ${id}`);
      }
    } catch {
      // Agent may not exist — safe to ignore
    }
  }

  // Require only when needed to avoid circular dependency
  const { seedDefaultAgent } = require('./seedDefaultAgent');
  await seedDefaultAgent();
};

module.exports = {
  ...methods,
  seedDatabase,
  comparePassword,

  getMessage,
  getMessages,
  saveMessage,
  recordMessage,
  updateMessage,
  deleteMessagesSince,
  deleteMessages,

  getConvoTitle,
  getConvo,
  saveConvo,
  deleteConvos,

  getPreset,
  getPresets,
  savePreset,
  deletePresets,

  Files: File,
};

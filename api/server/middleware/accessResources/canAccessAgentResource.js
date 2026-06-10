const { ResourceType } = require('librechat-data-provider');
const { canAccessResource } = require('./canAccessResource');
const { getAgent } = require('~/models/Agent');

const resolveAgentId = async (agentCustomId) => {
  return await getAgent({ id: agentCustomId });
};

const canAccessAgentResource = (options) => {
  const { requiredPermission, resourceIdParam = 'id' } = options;

  if (!requiredPermission || typeof requiredPermission !== 'number') {
    throw new Error('canAccessAgentResource: requiredPermission is required and must be a number');
  }

  return canAccessResource({
    resourceType: ResourceType.AGENT,
    requiredPermission,
    resourceIdParam,
    idResolver: resolveAgentId,
  });
};

module.exports = {
  canAccessAgentResource,
};

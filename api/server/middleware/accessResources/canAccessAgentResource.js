const { ResourceType, PermissionBits } = require('librechat-data-provider');
const { canAccessResource } = require('./canAccessResource');
const { getAgent } = require('~/models/Agent');

/**
 * Canonical IDs of Whatfix-branded agents that every authenticated user can view/use.
 * These bypass the ACL system for VIEW permission only.
 * EDIT/DELETE still require ADMIN role (handled by canAccessResource's ADMIN bypass).
 */
const GLOBAL_AGENT_IDS = new Set([
  'whatfix-presentation-creator',
  'whatfix-excel-creator',
  'whatfix-doc-creator',
]);

const resolveAgentId = async (agentCustomId) => {
  return await getAgent({ id: agentCustomId });
};

const canAccessAgentResource = (options) => {
  const { requiredPermission, resourceIdParam = 'id' } = options;

  if (!requiredPermission || typeof requiredPermission !== 'number') {
    throw new Error('canAccessAgentResource: requiredPermission is required and must be a number');
  }

  const baseMiddleware = canAccessResource({
    resourceType: ResourceType.AGENT,
    requiredPermission,
    resourceIdParam,
    idResolver: resolveAgentId,
  });

  // For VIEW-only requests on global agents, bypass ACL entirely.
  // EDIT/DELETE fall through to the normal middleware which grants access to ADMIN only.
  if (requiredPermission !== PermissionBits.VIEW) {
    return baseMiddleware;
  }

  return async (req, res, next) => {
    const rawId = req.params[resourceIdParam];

    if (rawId && GLOBAL_AGENT_IDS.has(rawId)) {
      const agent = await resolveAgentId(rawId).catch(() => null);
      if (!agent) {
        return res.status(404).json({ error: 'Not Found', message: 'agent not found' });
      }
      req.resourceAccess = {
        resourceType: ResourceType.AGENT,
        resourceId: agent._id,
        customResourceId: rawId,
        permission: requiredPermission,
        userId: req.user?.id,
      };
      return next();
    }

    return baseMiddleware(req, res, next);
  };
};

module.exports = {
  canAccessAgentResource,
  GLOBAL_AGENT_IDS,
};

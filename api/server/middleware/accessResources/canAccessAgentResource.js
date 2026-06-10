const { ResourceType, PermissionBits } = require('librechat-data-provider');
const { canAccessResource } = require('./canAccessResource');
const { getAgent } = require('~/models/Agent');

/**
 * Names of Whatfix-branded agents that every authenticated user can view/use.
 * Matched by name (not by id) so this works regardless of what id MongoDB assigned.
 * EDIT/DELETE still require ADMIN role (handled by canAccessResource's ADMIN bypass).
 */
const GLOBAL_AGENT_NAMES = new Set([
  'Presentation Creator',
  'Excel Creator',
  'Document Creator',
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

    if (rawId) {
      const agent = await resolveAgentId(rawId).catch(() => null);
      if (agent && GLOBAL_AGENT_NAMES.has(agent.name)) {
        req.resourceAccess = {
          resourceType: ResourceType.AGENT,
          resourceId: agent._id,
          customResourceId: rawId,
          permission: requiredPermission,
          userId: req.user?.id,
        };
        return next();
      }
    }

    return baseMiddleware(req, res, next);
  };
};

module.exports = {
  canAccessAgentResource,
  GLOBAL_AGENT_NAMES,
};

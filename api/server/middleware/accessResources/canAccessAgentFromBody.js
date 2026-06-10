const { logger } = require('@librechat/data-schemas');
const {
  Constants,
  ResourceType,
  isAgentsEndpoint,
  isEphemeralAgentId,
} = require('librechat-data-provider');
const { canAccessResource } = require('./canAccessResource');
const { getAgent } = require('~/models/Agent');

const resolveAgentIdFromBody = async (agentCustomId) => {
  if (isEphemeralAgentId(agentCustomId)) {
    return null;
  }
  return await getAgent({ id: agentCustomId });
};

const canAccessAgentFromBody = (options) => {
  const { requiredPermission } = options;

  if (!requiredPermission || typeof requiredPermission !== 'number') {
    throw new Error('canAccessAgentFromBody: requiredPermission is required and must be a number');
  }

  return async (req, res, next) => {
    try {
      const { endpoint, agent_id } = req.body;
      let agentId = agent_id;

      if (!isAgentsEndpoint(endpoint)) {
        agentId = Constants.EPHEMERAL_AGENT_ID;
      }

      if (!agentId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'agent_id is required in request body',
        });
      }

      if (isEphemeralAgentId(agentId)) {
        return next();
      }

      const resolvedAgent = await resolveAgentIdFromBody(agentId).catch(() => null);

      const agentAccessMiddleware = canAccessResource({
        resourceType: ResourceType.AGENT,
        requiredPermission,
        resourceIdParam: 'agent_id',
        idResolver: () => Promise.resolve(resolvedAgent),
      });

      const tempReq = {
        ...req,
        params: {
          ...req.params,
          agent_id: agentId,
        },
      };

      return agentAccessMiddleware(tempReq, res, next);
    } catch (error) {
      logger.error('Failed to validate agent access permissions', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate agent access permissions',
      });
    }
  };
};

module.exports = {
  canAccessAgentFromBody,
};

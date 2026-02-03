const { logger } = require('@librechat/data-schemas');
const { getTransactions } = require('~/models/Transaction');
const { Transaction } = require('~/db/models');

/**
 * Get API usage statistics for the authenticated user
 * @route GET /api/user/usage
 */
const getApiUsageController = async (req, res) => {
  try {
    logger.info('[getApiUsageController] API usage endpoint called');
    const userId = req.user?._id;
    const { conversationId, sessionId } = req.query;

    logger.info('[getApiUsageController] User ID:', userId, 'ConversationId:', conversationId, 'SessionId:', sessionId);

    if (!userId) {
      logger.warn('[getApiUsageController] No user ID found, returning 401');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Query actual transactions for usage tracking
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate usage by conversation
    let conversationUsage = null;
    if (conversationId) {
      const convoTransactions = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            conversationId: conversationId,
          },
        },
        {
          $group: {
            _id: '$tokenType',
            total: { $sum: { $abs: '$rawAmount' } },
            cost: { $sum: { $abs: '$tokenValue' } },
          },
        },
      ]);

      const promptData = convoTransactions.find(t => t._id === 'prompt') || { total: 0, cost: 0 };
      const completionData = convoTransactions.find(t => t._id === 'completion') || { total: 0, cost: 0 };

      conversationUsage = {
        totalTokens: promptData.total + completionData.total,
        inputTokens: promptData.total,
        outputTokens: completionData.total,
        totalCost: ((promptData.cost + completionData.cost) / 1000000).toFixed(6),
        messageCount: await Transaction.countDocuments({ user: userId, conversationId, tokenType: 'completion' }),
      };
    }

    // Today's usage
    const todayTransactions = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startOfToday },
        },
      },
      {
        $group: {
          _id: '$tokenType',
          total: { $sum: { $abs: '$rawAmount' } },
          cost: { $sum: { $abs: '$tokenValue' } },
          count: { $sum: 1 },
        },
      },
    ]);

    const todayPrompt = todayTransactions.find(t => t._id === 'prompt') || { total: 0, cost: 0, count: 0 };
    const todayCompletion = todayTransactions.find(t => t._id === 'completion') || { total: 0, cost: 0, count: 0 };

    // Monthly usage
    const monthTransactions = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: '$tokenType',
          total: { $sum: { $abs: '$rawAmount' } },
          cost: { $sum: { $abs: '$tokenValue' } },
          count: { $sum: 1 },
        },
      },
    ]);

    const monthPrompt = monthTransactions.find(t => t._id === 'prompt') || { total: 0, cost: 0, count: 0 };
    const monthCompletion = monthTransactions.find(t => t._id === 'completion') || { total: 0, cost: 0, count: 0 };

    const usageData = {
      // Current session usage (same as conversation for now)
      currentSession: conversationUsage ? {
        ...conversationUsage,
        requestCount: conversationUsage.messageCount,
        conversationId,
      } : null,
      
      // Current chat/conversation usage
      currentChat: conversationUsage,
      
      // Today's total usage
      today: {
        totalTokens: todayPrompt.total + todayCompletion.total,
        inputTokens: todayPrompt.total,
        outputTokens: todayCompletion.total,
        totalCost: ((todayPrompt.cost + todayCompletion.cost) / 1000000).toFixed(6),
        requestCount: todayCompletion.count,
      },
      
      // Monthly total usage
      currentMonth: {
        totalTokens: monthPrompt.total + monthCompletion.total,
        inputTokens: monthPrompt.total,
        outputTokens: monthCompletion.total,
        totalCost: ((monthPrompt.cost + monthCompletion.cost) / 1000000).toFixed(6),
        requestCount: monthCompletion.count,
      },
      
      pricing: {
        model: 'Claude Sonnet 4.5',
        description: 'Standard requests (up to 200K tokens)',
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        longContextInputCostPer1M: 6.00,
        longContextOutputCostPer1M: 22.50,
      },
      availableModels: [
        {
          name: 'Claude Sonnet 4.5',
          description: 'Standard requests (up to 200K tokens)',
          inputCostPer1M: 3.00,
          outputCostPer1M: 15.00,
        },
        {
          name: 'Claude Sonnet 4.5 (Long Context)',
          description: 'Long-context requests (over 200K tokens)',
          inputCostPer1M: 6.00,
          outputCostPer1M: 22.50,
        },
        {
          name: 'Claude Opus 4.5',
          description: 'Most advanced model',
          inputCostPer1M: 5.00,
          outputCostPer1M: 25.00,
        },
      ],
      batchProcessingDiscount: '50% off standard token prices',
      lastUpdated: new Date().toISOString(),
    };

    logger.info('[getApiUsageController] Returning usage data');
    res.json(usageData);
  } catch (error) {
    logger.error('[getApiUsageController] Error fetching API usage:', error);
    res.status(500).json({ message: 'Error fetching API usage data' });
  }
};

/**
 * Track a new API request (called after each API call)
 * @route POST /api/user/usage/track
 */
const trackApiUsageController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { inputTokens, outputTokens, model, cost } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // In production, save to a usage tracking collection
    logger.info('[trackApiUsageController] Tracked usage:', {
      userId,
      inputTokens,
      outputTokens,
      model,
      cost,
      timestamp: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[trackApiUsageController] Error tracking API usage:', error);
    res.status(500).json({ message: 'Error tracking API usage' });
  }
};

module.exports = {
  getApiUsageController,
  trackApiUsageController,
};

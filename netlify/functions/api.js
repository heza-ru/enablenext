const serverless = require('serverless-http');
const app = require('../../api/server/app');

// Wrap Express app with serverless-http
const handler = serverless(app);

module.exports.handler = async (event, context) => {
  // Prevent Lambda from waiting for empty event loop
  context.callbackWaitsForEmptyEventLoop = false;
  
  return await handler(event, context);
};

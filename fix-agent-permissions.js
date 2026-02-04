/**
 * Quick fix script to delete the broken agent and recreate with proper permissions
 * Run this once to fix the permission issue
 */

require('dotenv').config();
const path = require('path');
const { connectDb } = require('./api/db/connect');
const { Agent, AclEntry } = require('./api/db/models');
const { seedDefaultAgent } = require('./api/models/seedDefaultAgent');

async function fixAgentPermissions() {
  console.log('🔧 Fixing default agent permissions...\n');

  try {
    // Connect to database
    await connectDb();
    console.log('✅ Connected to MongoDB\n');

    const agentId = 'default-claude-web-search';

    // 1. Delete the broken agent
    console.log(`🗑️  Deleting existing agent: ${agentId}`);
    const deletedAgent = await Agent.findOneAndDelete({ id: agentId });
    
    if (deletedAgent) {
      console.log(`   ✅ Agent deleted: ${deletedAgent.name}\n`);
      
      // 2. Delete associated ACL entries
      console.log('🗑️  Cleaning up ACL entries...');
      const deletedACLs = await AclEntry.deleteMany({ resourceId: deletedAgent._id });
      console.log(`   ✅ Deleted ${deletedACLs.deletedCount} ACL entries\n`);
    } else {
      console.log('   ℹ️  Agent not found (might be already deleted)\n');
    }

    // 3. Recreate with proper permissions
    console.log('🚀 Creating new agent with public access...');
    const newAgent = await seedDefaultAgent();
    
    console.log('\n✅ SUCCESS! Agent recreated with proper permissions:');
    console.log(`   - ID: ${newAgent.id}`);
    console.log(`   - Name: ${newAgent.name}`);
    console.log(`   - Tools: ${newAgent.tools.join(', ')}`);
    console.log(`   - Author: ${newAgent.author}`);
    console.log('\n🎉 You can now use the agent in your UI!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixAgentPermissions();

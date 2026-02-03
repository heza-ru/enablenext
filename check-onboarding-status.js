// Quick script to check if a user has completed onboarding and will get personalized AI
// Usage: node check-onboarding-status.js <email>

require('dotenv').config();
const mongoose = require('mongoose');

const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node check-onboarding-status.js <email>');
  process.exit(1);
}

async function checkStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const User = mongoose.connection.collection('users');
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      await mongoose.disconnect();
      process.exit(1);
    }
    
    console.log(`\n👤 User: ${user.name || 'Unknown'} (${user.email})`);
    console.log(`Provider: ${user.provider}\n`);
    
    if (!user.onboarding) {
      console.log('❌ NO ONBOARDING DATA');
      console.log('   User needs to complete onboarding first.\n');
      await mongoose.disconnect();
      return;
    }
    
    const { completed, skipped, role, useCases, focusAreas, customInstructions } = user.onboarding;
    
    console.log('📊 Onboarding Status:');
    console.log(`   Completed: ${completed ? '✅' : '❌'}`);
    console.log(`   Skipped: ${skipped ? '⚠️  Yes' : '✅ No'}\n`);
    
    if (completed && !skipped) {
      console.log('🎉 PERSONALIZED AI IS ACTIVE!\n');
      console.log('🤖 AI will know:');
      console.log(`   • Your name: ${user.name || user.username || 'Not set'}`);
      console.log(`   • Your role: ${role || 'Not set'}`);
      
      if (role === 'sales_engineer') {
        console.log('   • Focus: Technical architecture, integrations, security, APIs');
      } else if (role === 'solutions_consultant') {
        console.log('   • Focus: Demos, storytelling, business outcomes, ROI');
      }
      
      if (useCases?.length > 0) {
        console.log(`   • Use cases: ${useCases.join(', ')}`);
      }
      
      if (focusAreas?.length > 0) {
        console.log(`   • Focus areas: ${focusAreas.join(', ')}`);
      }
      
      if (customInstructions) {
        console.log(`   • Custom instructions: ${customInstructions}`);
      }
      
      console.log('\n✅ The AI will tailor all responses based on this profile.\n');
    } else if (skipped) {
      console.log('⚠️  Onboarding was skipped');
      console.log('   User will get generic AI responses without personalization.\n');
    } else {
      console.log('❌ Onboarding not completed');
      console.log('   User needs to complete the onboarding flow.\n');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStatus();

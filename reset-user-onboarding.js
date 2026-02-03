// Helper script to reset onboarding for a user (for testing)
// Usage: node reset-user-onboarding.js <email>

require('dotenv').config();
const mongoose = require('mongoose');

const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node reset-user-onboarding.js <email>');
  process.exit(1);
}

async function resetOnboarding() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const User = mongoose.connection.collection('users');
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      await mongoose.disconnect();
      process.exit(1);
    }
    
    console.log(`Found user: ${email}`);
    console.log('Current onboarding:', JSON.stringify(user.onboarding, null, 2));
    
    const result = await User.updateOne(
      { email },
      {
        $set: {
          onboarding: {
            completed: false,
            skipped: false,
            completedAt: null,
            role: null,
            useCases: [],
            focusAreas: [],
            customInstructions: '',
          }
        }
      }
    );
    
    console.log('\n✅ Onboarding reset successfully!');
    console.log('Modified count:', result.modifiedCount);
    console.log('\nThe user will now see the onboarding popup on next login.');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetOnboarding();

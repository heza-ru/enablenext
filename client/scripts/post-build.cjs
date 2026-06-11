const fs = require('fs-extra');

async function postBuild() {
  try {
    await fs.copy('public/assets', 'dist/assets');
    await fs.copy('public/robots.txt', 'dist/robots.txt');
    await fs.copy('public/libs', 'dist/libs');
    console.log('✅ PWA icons, robots.txt, and libs copied successfully. Glob pattern warnings resolved.');
  } catch (err) {
    console.error('❌ Error copying files:', err);
    process.exit(1);
  }
}

postBuild();

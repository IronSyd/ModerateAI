/**
 * This script pushes the database schema to the database
 * Run with: node db-push.js
 */
const { execSync } = require('child_process');

(async () => {
  console.log('Pushing schema to database...');
  
  try {
    // Run drizzle-kit push to update the database schema
    execSync('npm run db:push', { stdio: 'inherit' });
    console.log('Schema pushed successfully!');
  } catch (error) {
    console.error('Error pushing schema:', error.message);
    process.exit(1);
  }
})();
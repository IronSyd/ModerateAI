import { execSync } from 'child_process';

console.log('Pushing database schema changes...');

try {
  // Run db:push with force flag to skip prompts
  execSync('echo "1" | npm run db:push', { 
    stdio: 'inherit',
    shell: true
  });
  console.log('Database schema updated successfully!');
} catch (error) {
  console.error('Error updating database schema:', error.message);
  process.exit(1);
}
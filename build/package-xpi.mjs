import { execSync } from 'child_process';
import { renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// Try zip first (Linux/macOS/Git Bash), fall back to PowerShell (Windows)
try {
  execSync('zip -r ../autosortplus.xpi *', { cwd: dist, stdio: 'inherit' });
  console.log('✅ autosortplus.xpi created (zip)');
} catch {
  console.log('zip not available, trying PowerShell...');
  try {
    execSync(
      'powershell Compress-Archive -Path * -DestinationPath ../autosortplus.zip -Force',
      { cwd: dist, stdio: 'inherit' }
    );
    renameSync(resolve(root, 'autosortplus.zip'), resolve(root, 'autosortplus.xpi'));
    console.log('✅ autosortplus.xpi created (PowerShell)');
  } catch (err) {
    console.error('Failed to create XPI:', err.message);
    process.exit(1);
  }
}

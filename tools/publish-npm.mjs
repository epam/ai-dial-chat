import { spawnSync } from 'child_process';

const publishArgs = ['run', 'publish'];
const forwardedArgs = process.argv.slice(2);

if (process.env.GITHUB_REF === 'refs/heads/development-1.0') {
  forwardedArgs.push('--development=true');
}

if (forwardedArgs.length > 0) {
  publishArgs.push('--', ...forwardedArgs);
}

const result = spawnSync('npm', publishArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);

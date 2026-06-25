const { spawn } = require('child_process');

const child = spawn('npx.cmd', ['drizzle-kit', 'push'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  // Whenever it asks a question about creation/renaming
  if (output.includes('?')) {
    child.stdin.write('\n');
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  process.exit(code);
});

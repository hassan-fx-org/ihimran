// Preflight check: abort before launching a second server that would crash with
// EADDRINUSE on port 5000. Prints who owns the port so the duplicate is obvious.
const net = require('net');

const PORT = parseInt(process.env.PORT || '5000', 10);
const socket = net.connect({ port: PORT, host: '127.0.0.1' });

function owningPid() {
  try {
    const { execSync } = require('child_process');
    const out = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf8' });
    const line = out.trim().split(/\r?\n/)[0];
    const pid = line && line.trim().split(/\s+/).pop();
    return pid ? ` (owning PID ${pid})` : '';
  } catch {
    return '';
  }
}

socket.on('connect', () => {
  console.error(`\n\u26a0\ufe0f  Port ${PORT} is already in use${owningPid()}.`);
  console.error('   Another AgentHack server is already running.');
  console.error('   - Stop the existing process first, then retry, or');
  console.error(`   - Run on another port: PORT=${PORT + 1} npm run dev`);
  socket.destroy();
  process.exit(1);
});

socket.on('error', () => {
  socket.destroy();
  process.exit(0);
});
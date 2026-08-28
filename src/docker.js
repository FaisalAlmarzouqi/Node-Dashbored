const execa = require('execa');
const path = require('path');

const COMPOSE_CWD = path.join(__dirname, '..');

async function composeUp() {
  return execa('docker', ['compose', 'up', '-d'], { cwd: COMPOSE_CWD });
}

async function composeDown() {
  return execa('docker', ['compose', 'down'], { cwd: COMPOSE_CWD });
}

async function stopContainer(containerName) {
  return execa('docker', ['stop', containerName]);
}

async function startContainer(containerName) {
  return execa('docker', ['start', containerName]);
}

async function isRunning(containerName) {
  try {
    const { stdout } = await execa('docker', ['inspect', '-f', '{{.State.Running}}', containerName]);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

// Returns { cpuPercent, memUsage, memPercent } or null if the container
// isn't running / stats can't be read.
async function getStats(containerName) {
  try {
    const { stdout } = await execa('docker', [
      'stats',
      '--no-stream',
      '--format',
      '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}',
      containerName,
    ]);
    const [cpuPercent, memUsage, memPercent] = stdout.trim().split('|');
    return { cpuPercent, memUsage, memPercent };
  } catch {
    return null;
  }
}

async function getContainerIp(containerName, network = 'benchy-net') {
  const { stdout } = await execa('docker', [
    'inspect',
    '-f',
    `{{(index .NetworkSettings.Networks "${network}").IPAddress}}`,
    containerName,
  ]);
  return stdout.trim();
}

module.exports = { composeUp, composeDown, stopContainer, startContainer, isRunning, getStats, getContainerIp };

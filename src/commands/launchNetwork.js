const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const chalk = require('chalk');
const { NETWORK_DIR } = require('../config/network');

function launchNetwork() {
  const workerPath = path.join(__dirname, 'launchNetworkWorker.js');
  const logFile = path.join(NETWORK_DIR, 'launch.log');
  fs.mkdirSync(NETWORK_DIR, { recursive: true });

  const child = spawn(process.execPath, [workerPath], {
    detached: true,
    stdio: 'ignore',
    cwd: path.join(__dirname, '..', '..'),
  });
  child.unref();

  console.log(chalk.green('Launching benchy network in the background...'));
  console.log(`  5 nodes (Alice, Bob, Cassandra validators; Driss, Elena full nodes)`);
  console.log(`  Clients: Geth (validators) + Nethermind (Driss, Elena), Clique PoA consensus.`);
  console.log(`  Progress log: ${logFile}`);
  console.log(`  Check status with ${chalk.cyan('benchy infos')} (may take ~30-90s to peer up and start sealing).`);
}

module.exports = { launchNetwork };

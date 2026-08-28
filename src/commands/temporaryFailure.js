const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const { getNode } = require('../config/network');

const DOWNTIME_MS = 40000;

function temporaryFailure(nodeName) {
  const node = getNode(nodeName); // throws for unknown node before we spawn anything

  const workerPath = path.join(__dirname, 'temporaryFailureWorker.js');
  const child = spawn(process.execPath, [workerPath, node.name], {
    detached: true,
    stdio: 'ignore',
    cwd: path.join(__dirname, '..', '..'),
  });
  child.unref();

  console.log(chalk.yellow(`${node.label} will be stopped now and brought back online in ${DOWNTIME_MS / 1000}s.`));
  console.log(`Run ${chalk.cyan('benchy infos')} to watch it go offline and recover.`);
}

module.exports = { temporaryFailure, DOWNTIME_MS };

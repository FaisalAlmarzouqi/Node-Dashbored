#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const docker = require('../docker');
const { getNode, NETWORK_DIR } = require('../config/network');
const { DOWNTIME_MS } = require('./temporaryFailure');

const LOG_FILE = path.join(NETWORK_DIR, 'launch.log');

function log(msg) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] temporary-failure: ${msg}\n`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const nodeName = process.argv[2];
  const node = getNode(nodeName);

  log(`stopping ${node.label} (${node.container})`);
  await docker.stopContainer(node.container);

  await sleep(DOWNTIME_MS);

  log(`restarting ${node.label} (${node.container})`);
  await docker.startContainer(node.container);
  log(`${node.label} restarted`);
}

main().catch((err) => log(`fatal: ${err.stack || err.message}`));

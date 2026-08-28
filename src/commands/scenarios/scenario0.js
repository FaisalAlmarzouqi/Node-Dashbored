const chalk = require('chalk');
const { getNodes } = require('../../config/network');
const rpc = require('../../rpc');
const { sleep, printBalances } = require('./util');

// Scenario 0: "initialize" the network — confirm nodes are peered and Clique
// is producing blocks, then report validator balances (funded at genesis).
async function scenario0(opts = {}) {
  const durationMs = (opts.duration || 60) * 1000;
  const nodes = getNodes();
  const validators = nodes.filter((n) => n.isValidator);

  console.log(chalk.bold(`Warming up the network for ${durationMs / 1000}s...`));
  const start = Date.now();
  let lastBlocks = {};
  while (Date.now() - start < durationMs) {
    const blocks = {};
    for (const v of validators) blocks[v.name] = await rpc.getBlockNumber(v);
    const line = validators.map((v) => `${v.label}=${blocks[v.name] ?? '?'}`).join('  ');
    console.log(`  [${Math.round((Date.now() - start) / 1000)}s] ${line}`);
    lastBlocks = blocks;
    await sleep(5000);
  }

  const producing = Object.values(lastBlocks).some((b) => b && b > 0);
  console.log(producing ? chalk.green('\nNetwork is up and Clique is producing blocks.') : chalk.red('\nNo blocks observed yet — network may still be starting.'));

  console.log(chalk.bold('\nValidator ETH balances:'));
  await printBalances(validators);
}

module.exports = { scenario0 };

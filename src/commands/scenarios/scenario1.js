const chalk = require('chalk');
const { getNode } = require('../../config/network');
const rpc = require('../../rpc');
const { sleep, waitForReceipt, ethers } = require('./util');

// Scenario 1: `from` sends 0.1 ETH to `to` every 10s. Defaults to Alice -> Bob
// but --from/--to let it run against different node pairs (bonus requirement).
async function scenario1(opts = {}) {
  const from = getNode(opts.from || 'alice');
  const to = getNode(opts.to || 'bob');
  const amount = opts.amount || '0.1';
  const intervalMs = 10000;
  const count = opts.count ? Number(opts.count) : Infinity;

  console.log(chalk.bold(`Scenario 1: ${from.label} -> ${to.label}, ${amount} ETH every 10s`));
  if (count !== Infinity) console.log(`  Running ${count} transfer(s). Ctrl+C to stop early.`);
  else console.log(`  Running until Ctrl+C.`);

  const wallet = rpc.getWallet(from);
  let i = 0;
  while (i < count) {
    i++;
    try {
      const tx = await wallet.sendTransaction({ to: to.address, value: ethers.parseEther(amount) });
      console.log(chalk.cyan(`\n[${i}] sent ${amount} ETH -> ${to.label}  tx=${tx.hash}`));
      const receipt = await waitForReceipt(from, tx.hash);
      if (receipt) {
        console.log(`    confirmed in block ${receipt.blockNumber}`);
      } else {
        console.log(chalk.yellow('    still pending after timeout (check mempool via `benchy infos`)'));
      }
      await sleep(2000); // let the block propagate to `to`'s own node before reading its balance
      const [fromBal, toBal] = await Promise.all([
        rpc.getBalanceEth(from, from.address),
        rpc.getBalanceEth(to, to.address),
      ]);
      console.log(`    balances -> ${from.label}: ${fromBal} ETH | ${to.label}: ${toBal} ETH`);
    } catch (err) {
      console.log(chalk.red(`    transfer failed: ${err.shortMessage || err.message}`));
    }
    if (i < count) await sleep(intervalMs);
  }
}

module.exports = { scenario1 };

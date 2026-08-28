const chalk = require('chalk');
const { getNode } = require('../../config/network');
const rpc = require('../../rpc');
const { sleep, ethers } = require('./util');

// Scenario 3: `from` sends 1 ETH to `to1`, then immediately tries to "cancel"
// it by broadcasting a same-nonce replacement with a much higher gas price
// sending the 1 ETH to `to2` instead. Whichever the pool/miner accepts wins;
// the other is dropped. Defaults to Cassandra -> Driss, replaced by -> Elena.
async function scenario3(opts = {}) {
  const from = getNode(opts.from || 'cassandra');
  const to1 = getNode(opts.to1 || 'driss');
  const to2 = getNode(opts.to2 || 'elena');
  const amount = ethers.parseEther('1');

  const provider = rpc.getProvider(from);
  const wallet = rpc.getWallet(from);
  const nonce = await provider.getTransactionCount(from.address, 'pending');
  const feeData = await provider.getFeeData();
  const baseGasPrice = feeData.gasPrice || ethers.parseUnits('2', 'gwei');

  console.log(chalk.bold(`Scenario 3: ${from.label} sends 1 ETH -> ${to1.label}, then tries to cancel with a higher-fee tx -> ${to2.label} (nonce ${nonce})`));

  const tx1 = await wallet.sendTransaction({
    to: to1.address,
    value: amount,
    nonce,
    type: 0,
    gasLimit: 21000,
    gasPrice: baseGasPrice,
  });
  console.log(`  [original]    tx=${tx1.hash}  -> ${to1.label}  gasPrice=${ethers.formatUnits(baseGasPrice, 'gwei')} gwei`);

  const replacementGasPrice = baseGasPrice * 5n;
  let tx2;
  try {
    tx2 = await wallet.sendTransaction({
      to: to2.address,
      value: amount,
      nonce,
      type: 0,
      gasLimit: 21000,
      gasPrice: replacementGasPrice,
    });
    console.log(`  [replacement] tx=${tx2.hash}  -> ${to2.label}  gasPrice=${ethers.formatUnits(replacementGasPrice, 'gwei')} gwei`);
  } catch (err) {
    console.log(chalk.red(`  replacement tx rejected: ${err.shortMessage || err.message}`));
  }

  console.log('\n  Waiting to see which transaction gets mined...');
  const start = Date.now();
  let winner = null;
  while (Date.now() - start < 60000 && !winner) {
    const [r1, r2] = await Promise.all([
      provider.getTransactionReceipt(tx1.hash).catch(() => null),
      tx2 ? provider.getTransactionReceipt(tx2.hash).catch(() => null) : null,
    ]);
    if (r1) winner = { label: to1.label, receipt: r1, kind: 'original' };
    else if (r2) winner = { label: to2.label, receipt: r2, kind: 'replacement' };
    else await sleep(3000);
  }

  if (winner) {
    console.log(chalk.green(`\n  Mined: the ${winner.kind} transaction to ${winner.label} was included (block ${winner.receipt.blockNumber}).`));
  } else {
    console.log(chalk.yellow('\n  Neither transaction was mined within the timeout — check `benchy infos` mempool.'));
  }

  // The receipt above was confirmed via `from`'s node; give the block a
  // moment to propagate to to1/to2's own nodes before reading balances from
  // them directly, or they can briefly report stale pre-tx balances.
  await sleep(3000);

  console.log(chalk.bold('\nBalances:'));
  for (const node of [from, to1, to2]) {
    const bal = await rpc.getBalanceEth(node, node.address);
    console.log(`  ${node.label.padEnd(10)} ${node.address}  ${chalk.bold(bal)} ETH`);
  }
}

module.exports = { scenario3 };

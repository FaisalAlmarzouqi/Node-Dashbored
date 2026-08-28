const chalk = require('chalk');
const { ethers } = require('ethers');
const rpc = require('../../rpc');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function printBalances(nodes) {
  for (const node of nodes) {
    const bal = await rpc.getBalanceEth(node, node.address);
    console.log(`  ${node.label.padEnd(10)} ${node.address}  ${chalk.bold(bal ?? '?')} ETH`);
  }
}

async function waitForReceipt(node, txHash, timeoutMs = 60000) {
  const provider = rpc.getProvider(node);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
    if (receipt) return receipt;
    await sleep(2000);
  }
  return null;
}

module.exports = { sleep, printBalances, waitForReceipt, ethers };

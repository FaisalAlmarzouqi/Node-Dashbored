const chalk = require('chalk');
const { getNode, loadContractArtifact } = require('../../config/network');
const rpc = require('../../rpc');
const { waitForReceipt, ethers } = require('./util');

// Scenario 2: `deployer` deploys the BY ERC20 (supply 3000) and sends 1000 to
// each of `to1`/`to2`. Defaults to Cassandra deploying, sending to Driss/Elena.
async function scenario2(opts = {}) {
  const deployer = getNode(opts.deployer || 'cassandra');
  const to1 = getNode(opts.to1 || 'driss');
  const to2 = getNode(opts.to2 || 'elena');
  const totalSupply = ethers.parseUnits('3000', 18);
  const share = ethers.parseUnits('1000', 18);

  const artifact = loadContractArtifact();
  const wallet = rpc.getWallet(deployer);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log(chalk.bold(`Scenario 2: ${deployer.label} deploys BY token (supply 3000)`));
  const contract = await factory.deploy(totalSupply);
  const deployTx = contract.deploymentTransaction();
  console.log(`  deploy tx=${deployTx.hash}`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(chalk.green(`  BY token deployed at ${address}`));

  console.log(`\n  Transferring 1000 BY -> ${to1.label}`);
  const tx1 = await contract.transfer(to1.address, share);
  await waitForReceipt(deployer, tx1.hash);
  console.log(`  tx=${tx1.hash} confirmed`);

  console.log(`\n  Transferring 1000 BY -> ${to2.label}`);
  const tx2 = await contract.transfer(to2.address, share);
  await waitForReceipt(deployer, tx2.hash);
  console.log(`  tx=${tx2.hash} confirmed`);

  console.log(chalk.bold('\nBY balances:'));
  for (const node of [deployer, to1, to2]) {
    const bal = await contract.balanceOf(node.address);
    console.log(`  ${node.label.padEnd(10)} ${node.address}  ${chalk.bold(ethers.formatUnits(bal, 18))} BY`);
  }
  console.log(chalk.gray(`\nToken contract address: ${address}`));
}

module.exports = { scenario2 };

const execa = require('execa');
const chalk = require('chalk');
const { saveTestnetNode } = require('../config/network');

const SUPPORTED_NETWORKS = ['sepolia', 'holesky'];

// Bonus: launch an extra Geth container connected to a public testnet so it
// can be inspected on its own via `benchy infos --node <name>`.
async function connectTestnet(name, opts = {}) {
  const network = (opts.network || 'sepolia').toLowerCase();
  if (!SUPPORTED_NETWORKS.includes(network)) {
    throw new Error(`Unsupported --network "${network}". Supported: ${SUPPORTED_NETWORKS.join(', ')}`);
  }

  const container = `benchy-testnet-${name.toLowerCase()}`;
  const rpcPort = Number(opts.rpcPort || 21100);
  const p2pPort = Number(opts.p2pPort || 31100);

  console.log(chalk.bold(`Connecting node "${name}" to public testnet ${network}...`));

  await execa('docker', [
    'run', '-d',
    '--name', container,
    '--network', 'benchy-net',
    '-p', `${rpcPort}:8545`,
    '-p', `${p2pPort}:30303`,
    '-p', `${p2pPort}:30303/udp`,
    '-v', `benchy-testnet-${name.toLowerCase()}-data:/root/.ethereum`,
    'ethereum/client-go:stable',
    `--${network}`,
    '--http', '--http.addr', '0.0.0.0', '--http.port', '8545',
    '--http.api', 'eth,net,web3,admin,txpool',
    '--syncmode', 'snap',
  ]);

  saveTestnetNode({
    name: name.toLowerCase(),
    label: name,
    client: 'geth',
    container,
    rpcPort,
    p2pPort,
    network,
    address: '0x0000000000000000000000000000000000000000',
  });

  console.log(chalk.green(`Container ${container} launched (syncing ${network}, this can take a while).`));
  console.log(`Inspect it with: ${chalk.cyan(`benchy infos --node ${name.toLowerCase()}`)}`);
}

module.exports = { connectTestnet };

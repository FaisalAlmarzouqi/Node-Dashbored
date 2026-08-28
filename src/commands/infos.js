const Table = require('cli-table3');
const chalk = require('chalk');
const docker = require('../docker');
const rpc = require('../rpc');
const { getNodes, getNode } = require('../config/network');
const { startWebDashboard } = require('../web/server');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function collectNodeInfo(node) {
  const running = await docker.isRunning(node.container);
  if (!running) {
    return {
      name: node.name,
      label: node.label,
      client: node.client,
      isValidator: node.isValidator,
      address: node.address,
      online: false,
    };
  }

  const [blockNumber, balance, peers, mempool, stats] = await Promise.all([
    rpc.getBlockNumber(node),
    rpc.getBalanceEth(node, node.address),
    rpc.getPeers(node),
    rpc.getMempoolCount(node),
    docker.getStats(node.container),
  ]);

  return {
    name: node.name,
    label: node.label,
    client: node.client,
    isValidator: node.isValidator,
    address: node.address,
    online: blockNumber !== null,
    blockNumber,
    balance,
    peerCount: peers.length,
    peers,
    mempool,
    cpu: stats ? stats.cpuPercent : null,
    mem: stats ? stats.memUsage : null,
  };
}

async function collectAll(nodes) {
  return Promise.all(nodes.map(collectNodeInfo));
}

function printTable(infos) {
  const table = new Table({
    head: ['Node', 'Client', 'Role', 'Status', 'Block', 'Peers', 'Mempool', 'CPU', 'Mem', 'Address', 'Balance (ETH)'],
    style: { head: ['cyan'] },
  });

  for (const info of infos) {
    if (!info.online) {
      table.push([
        info.label,
        info.client,
        info.isValidator ? 'validator' : 'full node',
        chalk.red('OFFLINE'),
        '-',
        '-',
        '-',
        '-',
        '-',
        info.address,
        '-',
      ]);
      continue;
    }
    table.push([
      info.label,
      info.client,
      info.isValidator ? 'validator' : 'full node',
      chalk.green('online'),
      info.blockNumber ?? '-',
      info.peerCount ?? '-',
      info.mempool ?? '-',
      info.cpu ?? '-',
      info.mem ?? '-',
      info.address,
      info.balance ?? '-',
    ]);
  }
  console.log(table.toString());
}

async function runOnce(opts) {
  const nodes = opts.node ? [getNode(opts.node)] : getNodes();
  const infos = await collectAll(nodes);
  if (opts.json) {
    console.log(JSON.stringify(infos, null, 2));
  } else {
    printTable(infos);
  }
  return infos;
}

async function infos(opts) {
  if (opts.web) {
    await startWebDashboard({ nodeFilter: opts.node, port: opts.port || 4000 });
    return;
  }

  if (opts.update) {
    const interval = (opts.update === true ? 60 : Number(opts.update)) * 1000;
    console.log(chalk.gray(`Refreshing every ${interval / 1000}s. Ctrl+C to stop.`));
    // eslint-disable-next-line no-constant-condition
    while (true) {
      console.clear();
      console.log(chalk.gray(new Date().toLocaleString()));
      await runOnce(opts);
      await sleep(interval);
    }
  } else {
    await runOnce(opts);
  }
}

module.exports = { infos, collectAll, collectNodeInfo };

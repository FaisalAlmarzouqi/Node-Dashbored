const { Command } = require('commander');
const chalk = require('chalk');

const { launchNetwork } = require('./commands/launchNetwork');
const { infos } = require('./commands/infos');
const { runScenario } = require('./commands/scenarios');
const { temporaryFailure } = require('./commands/temporaryFailure');
const { connectTestnet } = require('./commands/connectTestnet');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Shared implementation of the bonus `-u [time]` flag: "runs any command
// continuously each `time` seconds, 60 by default".
async function withUpdate(fn, updateOpt) {
  if (!updateOpt) {
    await fn();
    return;
  }
  const interval = (updateOpt === true ? 60 : Number(updateOpt)) * 1000;
  console.log(chalk.gray(`(-u) repeating every ${interval / 1000}s. Ctrl+C to stop.`));
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await fn();
    await sleep(interval);
  }
}

function buildCli() {
  const program = new Command();
  program.name('benchy').description('Launch, monitor and benchmark a private Ethereum network.').version('1.0.0');

  program
    .command('launch-network')
    .description('Launch the 5-node Clique network in the background (returns immediately).')
    .action(() => {
      launchNetwork();
    });

  program
    .command('infos')
    .description('Show per-node status: latest block, peers, mempool, CPU/mem, address & balance.')
    .option('-n, --node <name>', 'show only this node')
    .option('--web', 'serve a live-updating web dashboard instead of printing to the terminal')
    .option('--port <port>', 'port for --web (default 4000)', (v) => Number(v))
    .option('--json', 'print raw JSON instead of a table')
    .option('-u, --update [seconds]', 'repeat every N seconds (default 60) in the terminal')
    .action(async (opts) => {
      await infos(opts);
    });

  program
    .command('scenario <id>')
    .description('Run a benchmark scenario (0, 1, 2 or 3).')
    .option('--from <name>', 'override the sending node')
    .option('--to <name>', 'override the receiving node (scenario 1)')
    .option('--to1 <name>', 'override the first receiving node (scenario 2/3)')
    .option('--to2 <name>', 'override the second receiving node (scenario 2/3)')
    .option('--deployer <name>', 'override the deploying node (scenario 2)')
    .option('--amount <eth>', 'amount of ETH per transfer (scenario 1, default 0.1)')
    .option('--count <n>', 'number of transfers before stopping (scenario 1, default: run until Ctrl+C)')
    .option('--duration <seconds>', 'warm-up duration in seconds (scenario 0, default 60)', (v) => Number(v))
    .option('-u, --update [seconds]', 'repeat the whole scenario every N seconds (default 60)')
    .action(async (id, opts) => {
      await withUpdate(() => runScenario(id, opts), opts.update);
    });

  program
    .command('temporary-failure <node>')
    .description('Stop a node for 40s then bring it back online (runs in the background).')
    .option('-u, --update [seconds]', 'repeat every N seconds (default 60)')
    .action(async (node, opts) => {
      await withUpdate(() => temporaryFailure(node), opts.update);
    });

  program
    .command('connect-testnet <name>')
    .description('(bonus) Launch a node connected to a public testnet (sepolia/holesky).')
    .option('--network <network>', 'sepolia or holesky (default sepolia)')
    .option('--rpc-port <port>', 'host RPC port (default 21100)')
    .option('--p2p-port <port>', 'host P2P port (default 31100)')
    .action(async (name, opts) => {
      await connectTestnet(name, opts);
    });

  return program;
}

module.exports = { buildCli };

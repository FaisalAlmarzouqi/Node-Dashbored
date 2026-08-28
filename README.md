# benchy

A CLI to **launch, monitor and benchmark** a private Ethereum network. It brings up 5 nodes
running two different clients under Clique proof-of-authority consensus, gives you live
per-node stats (terminal or web dashboard), and ships four demo scenarios plus a chaos-testing
command to kill and revive a node.

## Network topology

| Node      | Client     | Role              | Address (deterministic, test-only)          |
|-----------|-----------|-------------------|-----------------------------------------------|
| Alice     | Geth      | validator (signer)| `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Bob       | Geth      | validator (signer)| `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Cassandra | Geth      | validator (signer)| `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| Driss     | Nethermind| full node         | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| Elena     | Nethermind| full node         | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |

- **Consensus**: Clique PoA, 5s block period, chain ID `133713`. Alice/Bob/Cassandra are the
  Clique signers (extraData in genesis); Driss/Elena are ordinary full nodes that sync and
  validate the same chain on a different client, to prove cross-client compatibility.
- **Two clients**: `ethereum/client-go` (Geth) for the validators, `nethermind/nethermind`
  (Nethermind) for the two full nodes — both run against config files (`network/genesis.json`
  / `network/chainspec.json`) generated from the same parameters so they agree on one chain.
- **Accounts**: all 5 keypairs are derived deterministically from the well-known test mnemonic
  `test test test ... junk` (same one Hardhat/Anvil use). **Never use these keys with real
  funds** — they are public. Validators are pre-funded at genesis (1,000,000 ETH each); Driss
  and Elena start at 0 and receive funds during the scenarios.
- Every node runs in its own Docker container on a shared bridge network (`benchy-net`).

## Requirements

- Docker (with Compose v2 — `docker compose ...`)
- Node.js 18+

## Setup

```bash
npm install
```

That's it — `network/genesis.json`, `network/chainspec.json`, `network/accounts.json`, the
validator keystores, and the compiled BY token artifact are already committed to the repo
(they're fully deterministic). If you ever want to regenerate them from scratch:

```bash
npm run generate-network   # re-derives accounts/genesis/chainspec/keystores
npm run compile            # recompiles contracts/BYToken.sol
```

Run the CLI with `node bin/benchy.js <command>`, or `npm link` once to get a global `benchy`
command (examples below assume `benchy` is on your PATH).

## Commands

### `benchy launch-network`

Generates nothing (config is already committed), runs `docker compose up -d`, then meshes all
5 nodes together (`admin_addPeer`) and lets the validators start sealing — all in a **detached
background process**, so the command itself returns immediately. Progress is appended to
`network/launch.log`; use `benchy infos` to watch nodes come online (~30-90s).

```bash
benchy launch-network
```

### `benchy infos`

Per-node: latest block, connected peers, mempool (pending+queued) tx count, CPU/mem (via
`docker stats`), Ethereum address and balance.

```bash
benchy infos                    # one-shot table in the terminal
benchy infos -n alice           # just one node
benchy infos --json             # raw JSON
benchy infos -u                 # refresh every 60s in the terminal
benchy infos -u 10              # refresh every 10s
benchy infos --web              # live dashboard at http://localhost:4000
benchy infos --web --port 5000  # custom port
```

### `benchy scenario <0|1|2|3>`

All scenarios print explicit before/after feedback (tx hashes, confirmations, balances).

- **`scenario 0`** — warm-up: polls block production for a bit (`--duration <seconds>`,
  default 60) and reports the 3 validators' ETH balances.
- **`scenario 1`** — Alice sends 0.1 ETH to Bob every 10 seconds, looping until Ctrl+C
  (or `--count <n>` transfers). Override the pair with `--from`/`--to` and the amount with
  `--amount`.
- **`scenario 2`** — Cassandra deploys the `BY` ERC20 (3000 supply) and sends 1000 to Driss and
  1000 to Elena. Override with `--deployer`/`--to1`/`--to2`.
- **`scenario 3`** — Cassandra sends 1 ETH to Driss, then immediately broadcasts a
  same-nonce replacement at 5x the gas price sending the 1 ETH to Elena instead (a
  cancel/speed-up). Reports which transaction actually got mined. Override with
  `--from`/`--to1`/`--to2`.

```bash
benchy scenario 0
benchy scenario 1 --count 6
benchy scenario 2
benchy scenario 3
benchy scenario 1 --from bob --to driss --amount 0.05   # different addresses (bonus)
```

### `benchy temporary-failure <node>`

Stops the given node's container, waits 40s, restarts it — in the background, so you can run
`benchy infos` concurrently to watch it go offline and recover.

```bash
benchy temporary-failure alice
```

### `-u [seconds]` (bonus, global)

Every command accepts `-u [seconds]` (default 60) to run continuously on that interval instead
of once. `infos` has its own optimized live-refresh loop; `scenario` and `temporary-failure`
re-run the whole command each interval.

```bash
benchy scenario 0 -u 30
benchy temporary-failure bob -u
```

### `benchy connect-testnet <name>` (bonus)

Launches an extra Geth container connected to a public testnet instead of the private
network, so it can be inspected on its own.

```bash
benchy connect-testnet watcher --network sepolia
benchy infos --node watcher     # only reports on this node
```

## Architecture

```
bin/benchy.js            entrypoint
src/cli.js                commander wiring for all subcommands
src/config/network.js     node topology + accounts + contract artifact loader
src/docker.js             docker compose/stop/start/stats wrappers
src/rpc.js                per-node JSON-RPC helpers (ethers)
src/commands/             one file per command; launch-network and
                           temporary-failure spawn detached "worker" scripts
                           so the parent CLI process returns immediately
src/commands/scenarios/   scenario 0-3 implementations
src/web/                  Express dashboard (served by `infos --web`)
contracts/                BYToken.sol (OpenZeppelin ERC20) + compiled artifact
scripts/                  one-off generators (accounts/genesis/chainspec, solc compile)
network/                  committed genesis/chainspec/accounts/keystores;
                           network/data/ (chain data, gitignored) is created at runtime
docker-compose.yml         the 5 node services
```

## Notes / limitations

- All key material in this repo is public test-only material tied to a well-known mnemonic —
  by design, so the network is reproducible without committing "real" secrets. Do not reuse
  these keys anywhere with value.
- `scenario 3`'s replacement uses legacy (`type: 0`) transactions with an explicit 5x gas-price
  bump so it comfortably clears Geth's default 10% replacement threshold.
- `connect-testnet` syncs a real public chain (`snap` mode) — it can take a while to catch up;
  `infos` will show it online with a low block number until it does.

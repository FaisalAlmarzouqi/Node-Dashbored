// Static topology matching docker-compose.yml, merged with the generated
// account data (network/accounts.json) which holds addresses/keys.
const fs = require('fs');
const path = require('path');

const NETWORK_DIR = path.join(__dirname, '..', '..', 'network');

const TOPOLOGY = [
  { name: 'alice', container: 'benchy-alice', client: 'geth', rpcPort: 21001, p2pPort: 31001, isValidator: true },
  { name: 'bob', container: 'benchy-bob', client: 'geth', rpcPort: 21002, p2pPort: 31002, isValidator: true },
  { name: 'cassandra', container: 'benchy-cassandra', client: 'geth', rpcPort: 21003, p2pPort: 31003, isValidator: true },
  { name: 'driss', container: 'benchy-driss', client: 'nethermind', rpcPort: 21004, p2pPort: 31004, isValidator: false },
  { name: 'elena', container: 'benchy-elena', client: 'nethermind', rpcPort: 21005, p2pPort: 31005, isValidator: false },
];

function loadAccounts() {
  const raw = fs.readFileSync(path.join(NETWORK_DIR, 'accounts.json'), 'utf8');
  return JSON.parse(raw);
}

function loadContractArtifact() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'contracts', 'artifacts', 'BYToken.json'), 'utf8');
  return JSON.parse(raw);
}

function loadTestnetNodes() {
  const file = path.join(NETWORK_DIR, 'testnet-nodes.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveTestnetNode(entry) {
  const file = path.join(NETWORK_DIR, 'testnet-nodes.json');
  const existing = loadTestnetNodes().filter((n) => n.name !== entry.name);
  existing.push(entry);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
}

function getNodes() {
  const accountsData = loadAccounts();
  const byName = new Map(accountsData.nodes.map((n) => [n.name, n]));
  const privateNodes = TOPOLOGY.map((t) => {
    const acc = byName.get(t.name);
    return {
      ...t,
      label: acc.label,
      address: acc.address,
      privateKey: acc.privateKey,
      rpcUrl: `http://127.0.0.1:${t.rpcPort}`,
    };
  });
  const testnetNodes = loadTestnetNodes().map((t) => ({
    ...t,
    isValidator: false,
    isTestnet: true,
    rpcUrl: `http://127.0.0.1:${t.rpcPort}`,
  }));
  return [...privateNodes, ...testnetNodes];
}

function getNode(name) {
  const node = getNodes().find((n) => n.name === name.toLowerCase());
  if (!node) {
    const names = getNodes().map((n) => n.name).join(', ');
    throw new Error(`Unknown node "${name}". Valid nodes: ${names}`);
  }
  return node;
}

module.exports = { getNodes, getNode, loadAccounts, loadContractArtifact, loadTestnetNodes, saveTestnetNode, NETWORK_DIR };

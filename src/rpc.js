const { ethers } = require('ethers');

const providerCache = new Map();

function getProvider(node) {
  if (!providerCache.has(node.name)) {
    providerCache.set(
      node.name,
      new ethers.JsonRpcProvider(node.rpcUrl, undefined, { staticNetwork: true, batchMaxCount: 1 })
    );
  }
  return providerCache.get(node.name);
}

function getWallet(node) {
  return new ethers.Wallet(node.privateKey, getProvider(node));
}

async function safeCall(fn, fallback = null) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function getBlockNumber(node) {
  const p = getProvider(node);
  return safeCall(() => p.getBlockNumber());
}

async function getBalanceEth(node, address) {
  const p = getProvider(node);
  const bal = await safeCall(() => p.getBalance(address));
  return bal === null ? null : ethers.formatEther(bal);
}

async function getPeerCount(node) {
  const p = getProvider(node);
  const hex = await safeCall(() => p.send('net_peerCount', []));
  return hex === null ? null : parseInt(hex, 16);
}

async function getPeers(node) {
  const p = getProvider(node);
  const peers = await safeCall(() => p.send('admin_peers', []));
  return peers || [];
}

async function getEnode(node) {
  const p = getProvider(node);
  const info = await safeCall(() => p.send('admin_nodeInfo', []));
  return info ? info.enode : null;
}

async function addPeer(node, enode) {
  const p = getProvider(node);
  return safeCall(() => p.send('admin_addPeer', [enode]));
}

// Returns pending + queued tx count in the mempool. Geth and Nethermind both
// support txpool_status returning { pending, queued } as hex counts.
async function getMempoolCount(node) {
  const p = getProvider(node);
  const status = await safeCall(() => p.send('txpool_status', []));
  if (!status) return null;
  const pending = parseInt(status.pending, 16) || 0;
  const queued = parseInt(status.queued, 16) || 0;
  return pending + queued;
}

async function isReachable(node) {
  const bn = await getBlockNumber(node);
  return bn !== null;
}

module.exports = {
  getProvider,
  getWallet,
  getBlockNumber,
  getBalanceEth,
  getPeerCount,
  getPeers,
  getEnode,
  addPeer,
  getMempoolCount,
  isReachable,
};

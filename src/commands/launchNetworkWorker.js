#!/usr/bin/env node
// Runs detached from the `benchy launch-network` CLI process so that command
// can return immediately. Brings the compose stack up, waits for each node's
// RPC to answer, then meshes all 5 nodes together via admin_addPeer.
const fs = require('fs');
const path = require('path');
const docker = require('../docker');
const rpc = require('../rpc');
const { getNodes, NETWORK_DIR } = require('../config/network');

const LOG_FILE = path.join(NETWORK_DIR, 'launch.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForRpc(node, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await rpc.isReachable(node)) return true;
    await sleep(2000);
  }
  return false;
}

// Both Geth and Nethermind self-report a useless host in admin_nodeInfo's
// enode when run without external NAT/DNS hints (Geth defaults to
// 127.0.0.1, Nethermind to 255.255.255.255). Since we run without discovery
// (--nodiscover / DiscoveryEnabled=false) and mesh peers explicitly, we
// rewrite the enode's host with the container's real bridge-network IP
// (and the fixed internal P2P port 30303) before handing it to peers.
async function correctedEnode(node) {
  const raw = await rpc.getEnode(node);
  if (!raw) return null;
  const match = raw.match(/^enode:\/\/([0-9a-fA-F]+)@/);
  if (!match) return null;
  const ip = await docker.getContainerIp(node.container);
  return `enode://${match[1]}@${ip}:30303`;
}

async function meshPeers(nodes) {
  const enodes = {};
  for (const node of nodes) {
    enodes[node.name] = await correctedEnode(node);
    log(`  ${node.label} enode host -> ${enodes[node.name]}`);
  }
  for (const a of nodes) {
    for (const b of nodes) {
      if (a.name === b.name) continue;
      const enode = enodes[b.name];
      if (enode) await rpc.addPeer(a, enode);
    }
  }
}

async function main() {
  fs.writeFileSync(LOG_FILE, '');
  log('launch-network: starting docker compose up -d');
  try {
    await docker.composeUp();
  } catch (err) {
    log(`docker compose up failed: ${err.message}`);
    return;
  }
  log('containers started, waiting for RPC endpoints...');

  const nodes = getNodes();
  const results = await Promise.all(nodes.map((n) => waitForRpc(n)));
  nodes.forEach((n, i) => log(`  ${n.label}: ${results[i] ? 'RPC up' : 'TIMED OUT waiting for RPC'}`));

  log('meshing peers (admin_addPeer)...');
  const expectedPeers = nodes.length - 1;
  for (let round = 1; round <= 5; round++) {
    await meshPeers(nodes);
    await sleep(5000);
    const counts = await Promise.all(nodes.map((n) => rpc.getPeerCount(n)));
    nodes.forEach((n, i) => log(`  [round ${round}] ${n.label}: ${counts[i] ?? 'unreachable'} peers`));
    if (counts.every((c) => c !== null && c >= expectedPeers)) break;
  }

  for (const n of nodes) {
    const peers = await rpc.getPeerCount(n);
    log(`  ${n.label}: ${peers === null ? 'unreachable' : peers + ' peers'}`);
  }

  log('network ready.');
}

main().catch((err) => log(`fatal: ${err.stack || err.message}`));

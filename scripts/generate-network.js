#!/usr/bin/env node
// Deterministically derives the 5 benchy accounts from a fixed, well-known
// test mnemonic (same idea as Hardhat's default accounts) and writes:
//   network/accounts.json    - name/address/privateKey for all 5 nodes
//   network/genesis.json     - Geth Clique genesis
//   network/chainspec.json   - Nethermind Clique chainspec (same chain)
//   network/keystore/<name>.json + network/keystore/<name>.password
//                             - V3 keystores for the 3 validators (used to
//                               unlock + seal blocks in Geth)
//
// Safe to re-run: it is fully deterministic, so output is byte-for-byte
// reproducible. Committed to the repo so `benchy launch-network` never has
// to generate secrets at run time.

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const NETWORK_DIR = path.join(__dirname, '..', 'network');
const KEYSTORE_DIR = path.join(NETWORK_DIR, 'keystore');

// Test-only mnemonic. NEVER use for real funds.
const MNEMONIC = 'test test test test test test test test test test test junk';
const KEYSTORE_PASSWORD = 'benchy-test-only';

const NODE_NAMES = ['alice', 'bob', 'cassandra', 'driss', 'elena'];
const VALIDATOR_NAMES = ['alice', 'bob', 'cassandra'];

const CHAIN_ID = 133713;
const CLIQUE_PERIOD = 5; // seconds per block
const CLIQUE_EPOCH = 30000;
const VALIDATOR_FUNDING = ethers.parseEther('1000000'); // 1,000,000 ETH each

function deriveAccounts() {
  const mnemonic = ethers.Mnemonic.fromPhrase(MNEMONIC);
  return NODE_NAMES.map((name, i) => {
    const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
    return {
      name,
      label: name[0].toUpperCase() + name.slice(1),
      address: wallet.address,
      privateKey: wallet.privateKey,
      isValidator: VALIDATOR_NAMES.includes(name),
    };
  });
}

function buildCliqueExtraData(signerAddresses) {
  // 32 bytes vanity + concatenated 20-byte signer addresses + 65 bytes seal
  const vanity = '00'.repeat(32);
  const signers = signerAddresses.map((a) => a.toLowerCase().replace(/^0x/, '')).join('');
  const seal = '00'.repeat(65);
  return '0x' + vanity + signers + seal;
}

function buildGenesis(accounts) {
  const validators = accounts.filter((a) => a.isValidator);
  const alloc = {};
  for (const acc of accounts) {
    if (acc.isValidator) {
      alloc[acc.address.toLowerCase()] = { balance: VALIDATOR_FUNDING.toString() };
    }
  }
  return {
    config: {
      chainId: CHAIN_ID,
      homesteadBlock: 0,
      eip150Block: 0,
      eip155Block: 0,
      eip158Block: 0,
      byzantiumBlock: 0,
      constantinopleBlock: 0,
      petersburgBlock: 0,
      istanbulBlock: 0,
      berlinBlock: 0,
      londonBlock: 0,
      clique: {
        period: CLIQUE_PERIOD,
        epoch: CLIQUE_EPOCH,
      },
    },
    difficulty: '0x1',
    gasLimit: '0x1c9c380',
    extraData: buildCliqueExtraData(validators.map((v) => v.address)),
    alloc,
  };
}

function buildChainspec(accounts, genesis) {
  // Nethermind chainspec mirroring the Geth genesis above so both clients
  // agree on the same chain (same chainId/genesis alloc/clique params).
  const validators = accounts.filter((a) => a.isValidator);
  const accountsSpec = {};
  for (const [addr, entry] of Object.entries(genesis.alloc)) {
    accountsSpec[addr] = { balance: '0x' + BigInt(entry.balance).toString(16) };
  }
  return {
    name: 'BenchyClique',
    engine: {
      clique: {
        params: {
          period: CLIQUE_PERIOD,
          epoch: CLIQUE_EPOCH,
          blockReward: '0x0',
        },
      },
    },
    params: {
      gasLimitBoundDivisor: '0x400',
      chainId: CHAIN_ID,
      // Default is 32 bytes, which rejects every post-genesis Clique header
      // (32-byte vanity + 65-byte seal = 97 bytes, more for genesis which
      // also carries the signer list). Matches Nethermind's own Goerli
      // chainspec, which used the same override for the same reason.
      maximumExtraDataSize: '0x200',
      maxCodeSize: 24576,
      maxCodeSizeTransition: 0,
      eip150Transition: 0,
      eip158Transition: 0,
      eip160Transition: 0,
      eip161abcTransition: 0,
      eip161dTransition: 0,
      eip155Transition: 0,
      eip140Transition: 0,
      eip211Transition: 0,
      eip214Transition: 0,
      eip658Transition: 0,
      eip145Transition: 0,
      eip1014Transition: 0,
      eip1052Transition: 0,
      eip1283DisableTransition: 0,
      eip1283ReenableTransition: 0,
      eip1344Transition: 0,
      eip1706Transition: 0,
      eip1884Transition: 0,
      eip2028Transition: 0,
      eip2565Transition: 0,
      eip2929Transition: 0,
      eip2930Transition: 0,
      eip1559Transition: 0,
      eip3198Transition: 0,
      eip3529Transition: 0,
      eip3541Transition: 0,
    },
    genesis: {
      // Standard "ethereum" seal (nonce/mixHash), matching Nethermind's own
      // Clique chainspecs (e.g. Goerli) -- extraData carries the Clique
      // vanity+signers+seal payload directly and must byte-for-byte match
      // the Geth genesis so both clients compute the same genesis hash.
      seal: {
        ethereum: {
          nonce: '0x0000000000000000',
          mixHash: '0x' + '00'.repeat(32),
        },
      },
      difficulty: '0x1',
      gasLimit: '0x1c9c380',
      extraData: genesis.extraData,
    },
    accounts: {
      ...accountsSpec,
      '0x0000000000000000000000000000000000000001': { builtin: { name: 'ecrecover', pricing: { linear: { base: 3000, word: 0 } } } },
      '0x0000000000000000000000000000000000000002': { builtin: { name: 'sha256', pricing: { linear: { base: 60, word: 12 } } } },
      '0x0000000000000000000000000000000000000003': { builtin: { name: 'ripemd160', pricing: { linear: { base: 600, word: 120 } } } },
      '0x0000000000000000000000000000000000000004': { builtin: { name: 'identity', pricing: { linear: { base: 15, word: 3 } } } },
    },
  };
}

async function buildKeystores(accounts) {
  for (const acc of accounts.filter((a) => a.isValidator)) {
    const wallet = new ethers.Wallet(acc.privateKey);
    const json = wallet.encryptSync(KEYSTORE_PASSWORD);
    // Geth expects the filename to start with UTC-- and expects the address
    // (without 0x) somewhere in the JSON, which ethers already includes.
    fs.writeFileSync(path.join(KEYSTORE_DIR, `${acc.name}.json`), json);
    fs.writeFileSync(path.join(KEYSTORE_DIR, `${acc.name}.password`), KEYSTORE_PASSWORD);
  }
}

async function main() {
  fs.mkdirSync(KEYSTORE_DIR, { recursive: true });

  const accounts = deriveAccounts();
  const genesis = buildGenesis(accounts);
  const chainspec = buildChainspec(accounts, genesis);

  fs.writeFileSync(
    path.join(NETWORK_DIR, 'accounts.json'),
    JSON.stringify(
      {
        chainId: CHAIN_ID,
        cliquePeriodSeconds: CLIQUE_PERIOD,
        nodes: accounts,
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(NETWORK_DIR, 'genesis.json'), JSON.stringify(genesis, null, 2));
  fs.writeFileSync(path.join(NETWORK_DIR, 'chainspec.json'), JSON.stringify(chainspec, null, 2));
  await buildKeystores(accounts);

  console.log('Generated network/accounts.json, genesis.json, chainspec.json, keystore/*');
  for (const acc of accounts) {
    console.log(`  ${acc.label.padEnd(10)} ${acc.address}${acc.isValidator ? '  (validator)' : ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

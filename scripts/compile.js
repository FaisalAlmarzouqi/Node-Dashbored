#!/usr/bin/env node
// Compiles contracts/BYToken.sol with solc and writes the ABI+bytecode to
// contracts/artifacts/BYToken.json. The artifact is committed so `benchy
// scenario 2` never needs a Solidity toolchain at run time.

const fs = require('fs');
const path = require('path');
const solc = require('solc');

const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts');
const ARTIFACTS_DIR = path.join(CONTRACTS_DIR, 'artifacts');
const OZ_DIR = path.join(__dirname, '..', 'node_modules', '@openzeppelin', 'contracts');

function findImports(importPath) {
  try {
    if (importPath.startsWith('@openzeppelin/contracts')) {
      const rel = importPath.replace('@openzeppelin/contracts', '');
      const full = path.join(OZ_DIR, rel);
      return { contents: fs.readFileSync(full, 'utf8') };
    }
    return { contents: fs.readFileSync(path.join(CONTRACTS_DIR, importPath), 'utf8') };
  } catch (err) {
    return { error: String(err) };
  }
}

function main() {
  const source = fs.readFileSync(path.join(CONTRACTS_DIR, 'BYToken.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'BYToken.sol': { content: source },
    },
    settings: {
      // Our genesis activates forks through London only (this is a Clique
      // PoA chain, not merged) so PUSH0 (Shanghai/EIP-3855) isn't available.
      // Target London explicitly or solc's default EVM version silently
      // emits PUSH0 and every deployment reverts with no revert data.
      evmVersion: 'london',
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage);
    process.exit(1);
  }

  const contract = output.contracts['BYToken.sol']['BYToken'];
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'BYToken.json'),
    JSON.stringify(
      {
        abi: contract.abi,
        bytecode: '0x' + contract.evm.bytecode.object,
      },
      null,
      2
    )
  );
  console.log('Compiled contracts/artifacts/BYToken.json');
}

main();

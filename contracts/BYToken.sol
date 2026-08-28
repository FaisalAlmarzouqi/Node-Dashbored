// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice The "BY" token used by benchy's scenario 2 (Cassandra deploys and
/// distributes 3000 BY to Driss and Elena).
contract BYToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Benchy Token", "BY") {
        _mint(msg.sender, initialSupply);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "../interfaces/IVault.sol";

contract MofiStrategyMulticall {

    function getStrategy(address[] calldata vaults) external view returns (address[] memory) {
        address[] memory strategies = new address[](vaults.length);

        for (uint i = 0; i < vaults.length; i++) {
            strategies[i] = IVault(vaults[i]).strategy();
        }

        return strategies;
    }
}
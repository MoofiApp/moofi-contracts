// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVault {

    function strategy() external view returns (address);
    
}
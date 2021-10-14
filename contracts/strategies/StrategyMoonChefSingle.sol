// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./common/StrategyCommonChefSingle.sol";

contract StrategyMoonChefSingle is StrategyCommonChefSingle {

    address constant private chefAddress = address(0x78Aa55Ce0b0DC7488d2C38BD92769f4d0C8196Ff);

    constructor(
        address _want,
        uint256 _poolId,
        address _vault,
        address _unirouter,
        address _keeper,
        address _mofiFeeRecipient,
        address[] memory _outputToNativeRoute,
        address[] memory _outputToWant
    ) StrategyCommonChefSingle(
        _want,
        _poolId,
        chefAddress,
        _vault,
        _unirouter,
        _keeper,
        _mofiFeeRecipient,
        _outputToNativeRoute,
        _outputToWant
    ) {}
}
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./common/StrategyCommonChefSingle.sol";

contract StrategySolarChefSingle is StrategyCommonChefSingle {

    address constant private chefAddress = address(0xf03b75831397D4695a6b9dDdEEA0E578faa30907);

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
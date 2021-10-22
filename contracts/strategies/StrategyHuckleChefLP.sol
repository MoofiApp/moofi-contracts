// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./common/StrategyCommonChefFeeLP.sol";

contract StrategyHuckleChefLP is StrategyCommonChefFeeLP {

    address constant private chefAddress = address(0x1f4b7660b6AdC3943b5038e3426B33c1c0e343E6);

    constructor(
        address _want,
        uint256 _poolId,
        address _vault,
        address _unirouter,
        address _keeper,
        address _mofiFeeRecipient,
        address[] memory _outputToNativeRoute,
        address[] memory _outputToLp0Route,
        address[] memory _outputToLp1Route
    ) StrategyCommonChefFeeLP(
        _want,
        _poolId,
        chefAddress,
        _vault,
        _unirouter,
        _keeper,
        _mofiFeeRecipient,
        _outputToNativeRoute,
        _outputToLp0Route,
        _outputToLp1Route
    ) {}
}
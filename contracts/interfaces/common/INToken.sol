// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface INToken is IERC20 {
    function mint(uint256 _amount) external;

    function redeemUnderlying(uint256 _redeemAmount) external;
    
    function redeem(uint256 _redeemTokens) external;

    function exchangeRateStored() external view returns (uint256);

    function underlying() external view returns (address);

    function borrowBalanceStored() external view returns (uint256);
}

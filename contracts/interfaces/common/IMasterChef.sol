// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMasterChef {
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. moonfarms to distribute per block.
        uint256 lastRewardBlock;  // Last block number that moonfarms distribution occurs.
        uint256 accmoonfarmPerShare;   // Accumulated moonfarms per share, times 1e12. See below.
        uint16 depositFeeBP;      // Deposit fee in basis points
    }

    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);
    function emergencyWithdraw(uint256 _pid) external;
    function poolInfo(uint256 _pid) external view returns (PoolInfo memory);
}
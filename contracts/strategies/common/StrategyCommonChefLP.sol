// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../interfaces/common/IUniswapRouterETH.sol";
import "../../interfaces/common/IUniswapV2Pair.sol";
import "../../interfaces/common/IMasterChef.sol";
import "./StratManager.sol";

contract StrategyCommonChefLP is StratManager {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // 2% harvest fee
    uint constant public HARVEST_FEE = 20;

    // Tokens used
    address immutable public native;
    address immutable public output;
    address immutable public want;
    address immutable public lpToken0;
    address immutable public lpToken1;

    // Third party contracts
    address immutable public chef;
    uint256 immutable public poolId;

    // Routes
    address[] public toNativeRoute;
    address[] public toLp0Route;
    address[] public toLp1Route;
    bool immutable public isNativeRoutes;

    /**
     * @dev Event that is fired each time someone harvests the strat.
     */
    event StratHarvest(address indexed harvester);

    constructor(
        address _want,
        uint256 _poolId,
        address _chef,
        address _vault,
        address _unirouter,
        address _keeper,
        address _mofiFeeRecipient,
        address[] memory _toNativeRoute,
        address[] memory _toLp0Route,
        address[] memory _toLp1Route
    ) StratManager(_keeper, _unirouter, _vault, _mofiFeeRecipient) {
        want = _want;
        poolId = _poolId;
        chef = _chef;

        address _output = _toNativeRoute[0];
        require(_output != address(0), "!output");
        output = _output;

        address _native = _toNativeRoute[_toNativeRoute.length - 1];
        require(_native != address(0), "!native");
        native = _native;
        toNativeRoute = _toNativeRoute;

        // setup lp routing
        address _lpToken0 = IUniswapV2Pair(_want).token0();
        require(_lpToken0 == _toLp0Route[_toLp0Route.length - 1], "!token0");
        toLp0Route = _toLp0Route;
        lpToken0 = _lpToken0;

        address _lpToken1 = IUniswapV2Pair(_want).token1();
        require(_lpToken1 == _toLp1Route[_toLp1Route.length - 1], "!token1");
        toLp1Route = _toLp1Route;
        lpToken1 = _lpToken1;

        isNativeRoutes = (_toLp0Route[0] == _native && _toLp1Route[0] == _native);

        _giveAllowancesArguments(_want, _chef, _output, _unirouter, _lpToken0, _lpToken1, _native);
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            IMasterChef(chef).deposit(poolId, wantBal);
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            IMasterChef(chef).withdraw(poolId, _amount.sub(wantBal));
            wantBal = IERC20(want).balanceOf(address(this));
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        IERC20(want).safeTransfer(vault, wantBal);
    }

    // compounds earnings and charges performance fee
    function harvest() public virtual whenNotPaused onlyEOA {
        IMasterChef(chef).deposit(poolId, 0);

        if (isNativeRoutes) {
            swapAllToNative();
            chargeFeesNative();
            addLiquidityFrom(native);
        } else {
            chargeFees();
            addLiquidityFrom(output);
        }

        deposit();

        emit StratHarvest(msg.sender);
    }

    // performance fees
    function swapAllToNative() internal {
        uint256 toNative = IERC20(output).balanceOf(address(this));
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(toNative, 0, toNativeRoute, address(this), block.timestamp);
    }

    function chargeFees() internal {
        uint256 toNative = IERC20(output).balanceOf(address(this)).mul(HARVEST_FEE).div(1000);
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(toNative, 0, toNativeRoute, address(this), block.timestamp);

        uint256 nativeBal = IERC20(native).balanceOf(address(this));
        transferFees(nativeBal);
    }

    function chargeFeesNative() internal {
        uint256 nativeFees = IERC20(native).balanceOf(address(this)).mul(HARVEST_FEE).div(1000);
        transferFees(nativeFees);
    }

    function transferFees(uint256 amount) internal {
        IERC20(native).safeTransfer(mofiFeeRecipient, amount);
    }

    // Adds liquidity to AMM and gets more LP tokens.
    function addLiquidityFrom(address yield) internal {
        uint256 yieldHalf = IERC20(yield).balanceOf(address(this)).div(2);

        if (lpToken0 != yield) {
            IUniswapRouterETH(unirouter).swapExactTokensForTokens(yieldHalf, 0, toLp0Route, address(this), block.timestamp);
        }

        if (lpToken1 != yield) {
            IUniswapRouterETH(unirouter).swapExactTokensForTokens(yieldHalf, 0, toLp1Route, address(this), block.timestamp);
        }

        uint256 lp0Bal = IERC20(lpToken0).balanceOf(address(this));
        uint256 lp1Bal = IERC20(lpToken1).balanceOf(address(this));
        uint256 lp0BalMinimum = lp0Bal.mul(98).div(100);
        uint256 lp1BalMinimum = lp1Bal.mul(98).div(100);
        IUniswapRouterETH(unirouter).addLiquidity(lpToken0, lpToken1, lp0Bal, lp1Bal, lp0BalMinimum, lp1BalMinimum, address(this), block.timestamp);
    }

    // calculate the total underlaying 'want' held by the strat.
    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    // it calculates how much 'want' this contract holds.
    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    // it calculates how much 'want' the strategy has working in the farm.
    function balanceOfPool() public view returns (uint256) {
        (uint256 _amount, ) = IMasterChef(chef).userInfo(poolId, address(this));
        return _amount;
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        IMasterChef(chef).emergencyWithdraw(poolId);

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        IMasterChef(chef).emergencyWithdraw(poolId);
    }

    function pause() public onlyManager {
        _pause();

        _removeAllowances();
    }

    function unpause() external onlyManager {
        _unpause();

        _giveAllowances();

        deposit();
    }

    function _giveAllowances() internal {
        _giveAllowancesArguments(want, chef, output, unirouter, lpToken0, lpToken1, native);
    }

    function _giveAllowancesArguments(
        address _want,
        address _chef,
        address _output,
        address _unirouter,
        address _lpToken0,
        address _lpToken1,
        address _native
    ) internal {
        IERC20(_want).safeApprove(_chef, type(uint128).max);
        IERC20(_output).safeApprove(_unirouter, type(uint128).max);

        IERC20(_lpToken0).safeApprove(_unirouter, 0);
        IERC20(_lpToken0).safeApprove(_unirouter, type(uint128).max);

        IERC20(_lpToken1).safeApprove(_unirouter, 0);
        IERC20(_lpToken1).safeApprove(_unirouter, type(uint128).max);

        IERC20(_native).safeApprove(_unirouter, 0);
        IERC20(_native).safeApprove(_unirouter, type(uint128).max);
    }

    function _removeAllowances() internal {
        IERC20(want).safeApprove(chef, 0);
        IERC20(output).safeApprove(unirouter, 0);
        IERC20(lpToken0).safeApprove(unirouter, 0);
        IERC20(lpToken1).safeApprove(unirouter, 0);
        if (isNativeRoutes) {
            IERC20(native).safeApprove(unirouter, 0);
        }
    }

    function routeToNative() external view returns(address[] memory) {
        return toNativeRoute;
    }

    function routeToLp0() external view returns(address[] memory) {
        return toLp0Route;
    }

    function routeToLp1() external view returns(address[] memory) {
        return toLp1Route;
    }
}

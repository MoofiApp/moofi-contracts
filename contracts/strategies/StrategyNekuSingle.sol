// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interfaces/common/IUniswapRouterETH.sol";
import "../interfaces/common/IMasterChef.sol";
import "../interfaces/common/INToken.sol";
import "./common/StratManager.sol";

contract StrategyNekuSingle is StratManager {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // 2% harvest fee
    uint256 public constant HARVEST_FEE = 20;

    // Tokens used
    address public immutable native;
    address public immutable output;
    address public immutable want;
    address public immutable ntoken;

    // Third party contracts
    address public constant chef =
        address(0x1E930c6a1Ec0E098617a2c202939eD0345A9641e);
    uint256 public immutable poolId;

    // Routes
    address[] public toNativeRoute;
    address[] public toWantRoute;
    bool public immutable isNativeRoutes;

    uint256 public lastHarvest;

    /**
     * @dev Event that is fired each time someone harvests the strat.
     */
    event StratHarvest(address indexed harvester);

    constructor(
        address _want,
        address _ntoken,
        uint256 _poolId,
        address _vault,
        address _unirouter,
        address _keeper,
        address _mofiFeeRecipient,
        address[] memory _toNativeRoute,
        address[] memory _toWantRoute
    ) StratManager(_keeper, _unirouter, _vault, _mofiFeeRecipient) {
        want = _want;
        poolId = _poolId;
        ntoken = _ntoken;

        address _output = _toNativeRoute[0];
        require(_output != address(0), "!output");
        output = _output;

        address _native = _toNativeRoute[_toNativeRoute.length - 1];
        require(_native != address(0), "!native");
        native = _native;
        toNativeRoute = _toNativeRoute;

        require(_toWantRoute[0] == _output, "!toWantRouteFirst");
        require(
            _toWantRoute[_toWantRoute.length - 1] == _want,
            "!toWantRouteLast"
        );
        toWantRoute = _toWantRoute;

        isNativeRoutes = _toWantRoute[0] == _native;

        _giveAllowancesArguments(_want, _output, _unirouter, _native, _ntoken);
    }

    // puts the funds to work
    function deposit() public whenNotPaused {
        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal > 0) {
            INToken(ntoken).mint(wantBal);

            uint256 ntokenBal = INToken(ntoken).balanceOf(address(this));
            require(ntokenBal > 0, "!ntokenBal");
            IMasterChef(chef).deposit(poolId, ntokenBal);
        }
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == vault, "!vault");

        uint256 wantBal = IERC20(want).balanceOf(address(this));

        if (wantBal < _amount) {
            uint256 neededBal = _amount.sub(wantBal);
            uint256 nNeededBal = calculateNTokenAmount(neededBal);
            IMasterChef(chef).withdraw(poolId, nNeededBal);
            INToken(ntoken).redeemUnderlying(neededBal);
            wantBal = IERC20(want).balanceOf(address(this));
            require(wantBal >= _amount, "!redeem");
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        IERC20(want).safeTransfer(vault, wantBal);
    }

    // compounds earnings and charges performance fee
    function harvest() public virtual whenNotPaused onlyEOA {
        IMasterChef(chef).deposit(poolId, 0);

        uint256 outputBal = IERC20(output).balanceOf(address(this));
        if (outputBal > 0) {
            if (isNativeRoutes) {
                swapAllToNative();
                chargeFeesNative();
                swapToWant(native);
            } else {
                chargeFees();
                swapToWant(output);
            }

            deposit();

            lastHarvest = block.timestamp;
            emit StratHarvest(msg.sender);
        }
    }

    // performance fees
    function swapAllToNative() internal {
        uint256 toNative = IERC20(output).balanceOf(address(this));
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(
            toNative,
            0,
            toNativeRoute,
            address(this),
            block.timestamp
        );
    }

    function chargeFees() internal {
        uint256 toNative = IERC20(output)
            .balanceOf(address(this))
            .mul(HARVEST_FEE)
            .div(1000);
        IUniswapRouterETH(unirouter).swapExactTokensForTokens(
            toNative,
            0,
            toNativeRoute,
            address(this),
            block.timestamp
        );

        uint256 nativeBal = IERC20(native).balanceOf(address(this));
        transferFees(nativeBal);
    }

    function chargeFeesNative() internal {
        uint256 nativeFees = IERC20(native)
            .balanceOf(address(this))
            .mul(HARVEST_FEE)
            .div(1000);
        transferFees(nativeFees);
    }

    function transferFees(uint256 amount) internal {
        IERC20(native).safeTransfer(mofiFeeRecipient, amount);
    }

    function swapToWant(address yield) internal {
        uint256 amount = IERC20(yield).balanceOf(address(this));

        if (want != yield) {
            IUniswapRouterETH(unirouter).swapExactTokensForTokens(
                amount,
                0,
                toWantRoute,
                address(this),
                block.timestamp
            );
        }
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
        // 2998522443
        return calculateUnderlyingTokenAmount(_amount);
    }

    // called as part of strat migration. Sends all the available funds back to the vault.
    function retireStrat() external {
        require(msg.sender == vault, "!vault");

        IMasterChef(chef).emergencyWithdraw(poolId);
        uint256 toRedeem = INToken(ntoken).balanceOf(address(this));
        if (toRedeem > 0) {
            INToken(ntoken).redeem(toRedeem);
        }

        uint256 wantBal = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, wantBal);
    }

    // pauses deposits and withdraws all funds from third party systems.
    function panic() public onlyManager {
        pause();
        IMasterChef(chef).emergencyWithdraw(poolId);
        INToken(ntoken).redeem(INToken(ntoken).balanceOf(address(this)));
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

    function calculateNTokenAmount(uint256 _underlyingAmount)
        public
        view
        returns (uint256)
    {
        uint256 exchangeRate = INToken(ntoken).exchangeRateStored();
        uint8 power = ERC20(want).decimals();
        return _underlyingAmount.mul(10**power).div(exchangeRate);
    }

    function calculateUnderlyingTokenAmount(uint256 _nTokenAmount)
        public
        view
        returns (uint256)
    {
        uint256 exchangeRate = INToken(ntoken).exchangeRateStored();
        uint8 power = ERC20(want).decimals();
        return _nTokenAmount.mul(exchangeRate).div(10**power);
    }

    function _giveAllowances() internal {
        _giveAllowancesArguments(want, output, unirouter, native, ntoken);
    }

    function _giveAllowancesArguments(
        address _want,
        address _output,
        address _unirouter,
        address _native,
        address _ntoken
    ) internal {
        IERC20(_want).safeApprove(_ntoken, type(uint128).max);
        IERC20(_ntoken).safeApprove(chef, type(uint128).max);
        IERC20(_output).safeApprove(_unirouter, type(uint96).max);

        IERC20(_native).safeApprove(_unirouter, 0);
        IERC20(_native).safeApprove(_unirouter, type(uint128).max);
    }

    function _removeAllowances() internal {
        IERC20(want).safeApprove(ntoken, 0);
        IERC20(ntoken).safeApprove(chef, 0);
        IERC20(output).safeApprove(unirouter, 0);
        if (isNativeRoutes) {
            IERC20(native).safeApprove(unirouter, 0);
        }
    }

    function routeToNative() external view returns (address[] memory) {
        return toNativeRoute;
    }

    function routeToWant() external view returns (address[] memory) {
        return toWantRoute;
    }
}


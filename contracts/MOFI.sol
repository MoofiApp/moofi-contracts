pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract MOFI is ERC20Capped {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    uint256 private constant TOKENS_COUNT = 1000000;
    
    constructor() ERC20("mofi.finance", "MOFI") ERC20Capped(TOKENS_COUNT * 10 ** decimals()) {
        ERC20._mint(_msgSender(), TOKENS_COUNT * 10 ** decimals());
    }
}

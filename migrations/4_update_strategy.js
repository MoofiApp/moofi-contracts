const MofiVault = artifacts.require("MofiVault");
const MOFI = artifacts.require("MOFI");
const StrategyMoonChefLP = artifacts.require("StrategyMoonChefLP");

module.exports = async function (deployer, network, accounts) {
  const vault = await MofiVault.deployed();
  const wmovrToken = "0x98878B06940aE243284CA214f92Bb71a2b032B8A";
  const moonToken = "0xB497c3E9D27Ba6b1fea9F1b941d8C79E66cfC9d6";
  const daiToken = "0x80A16016cC4A2E6a2CACA8a4a498b1699fF0f844";
  const usdcToken = "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D";
  const lpToken = "0x07866497aAF2E8B201300759720C5Ac873DbF0e7";
  const feeAccountAddress = "0x6A90b35784c716dB7B269f2Eda2fB7e7C164Bb06";
  await deployer.deploy(
    StrategyMoonChefLP,
    lpToken,
    26,
    "0xfeF9F94431eC1f4c74512fCA7de2F9cd4dfE35E0",
    "0x120999312896F36047fBcC44AD197b7347F499d6",
    accounts[0],
    feeAccountAddress,
    [moonToken, wmovrToken],
    [moonToken, usdcToken, daiToken],
    [moonToken, usdcToken],
  );
};

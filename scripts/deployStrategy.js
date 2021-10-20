const hardhat = require("hardhat");

const ERC20ABI = require("../abis/ERC20.json");
const INTokenABI = require("../abis/INToken.json");
const masterchefABI = require("../abis/IMasterChef.json");
const mofiVaultABI = require("../abis/MofiVault.json");

const { addressBook } = require("moofi-addressbook");
const { mofi, solar, neku } = addressBook.moonriver.platforms;
const { SOLAR, WMOVR, USDC, NEKU } = addressBook.moonriver.tokens;
const baseTokenAddresses = [SOLAR, WMOVR, USDC].map((t) => t.address);

const ethers = hardhat.ethers;

const poolId = 1;
const vaultAddress = "0x4AEc841B98F605751F00c3a27A5799496495a76E";
const strategyContractName = "StrategyNekuSingle";

async function main() {
  const deployer = await ethers.getSigner();

  const masterchefContract = new ethers.Contract(
    neku.masterchef,
    masterchefABI,
    deployer,
  );
  const poolInfo = await masterchefContract.poolInfo(poolId);
  const nToken = ethers.utils.getAddress(poolInfo.lpToken);

  const nTokenContract = new ethers.Contract(nToken, INTokenABI, deployer);
  const token = await nTokenContract.underlying();

  const tokenContract = new ethers.Contract(token, ERC20ABI, deployer);
  const tokenDecimals = await tokenContract.decimals();
  const tokenSymbol = await tokenContract.symbol();

  await hardhat.run("compile");

  const vault = new ethers.Contract(vaultAddress, mofiVaultABI, deployer);
  const Strategy = await ethers.getContractFactory(strategyContractName);

  const strategyParams = {
    want: token,
    nToken: nToken,
    poolId: poolId,
    vault: vault.address,
    unirouter: solar.router,
    keeper: mofi.keeper,
    mofiFeeRecipient: mofi.mofiFeeRecipient,
    outputToNativeRoute: [NEKU.address, USDC.address, WMOVR.address],
    outputToWantRoute: [NEKU.address],
  };

  if (Object.values(strategyParams).some((v) => v === undefined)) {
    console.error("one of config values undefined");
    return;
  }

  console.log("Deploying...");

  // const strategy = await Strategy.deploy(...Object.values(strategyParams), { gasLimit: 1000000  });
  const strategy = await Strategy.deploy(...Object.values(strategyParams));
  await strategy.deployed();

  console.log("Strategy deployed to:", strategy.address);
  console.log("Upgrading strat...");

  // await vault.proposeStrat(strategy.address);
  // await vault.upgradeStrat();

  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

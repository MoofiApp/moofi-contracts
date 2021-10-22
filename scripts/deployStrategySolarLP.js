const hardhat = require("hardhat");

const ERC20ABI = require("../abis/ERC20.json");
const masterchefABI = require("../abis/IMasterChef.json");
const LPPairABI = require("../abis/IUniswapV2Pair.json");
const mofiVaultABI = require("../abis/MofiVault.json");

const { addressBook } = require("moofi-addressbook");
const { mofi, solar } = addressBook.moonriver.platforms;
const { SOLAR, WMOVR, USDC } = addressBook.moonriver.tokens;
const baseTokenAddresses = [SOLAR, WMOVR, USDC].map((t) => t.address);

const ethers = hardhat.ethers;

const poolId = 12;
const vaultAddress = "0x831F809A8F68ea3f5238914f13650b5FFFFc4fe5";
const strategyContractName = "StrategySolarChefLP";

async function main() {
  const deployer = await ethers.getSigner();

  const masterchefContract = new ethers.Contract(
    solar.masterchef,
    masterchefABI,
    deployer,
  );
  const poolInfo = await masterchefContract.poolInfo(poolId);
  const lpAddress = ethers.utils.getAddress(poolInfo.lpToken);

  const lpContract = new ethers.Contract(lpAddress, LPPairABI, deployer);
  const lpPair = {
    address: lpAddress,
    token0: await lpContract.token0(),
    token1: await lpContract.token1(),
    decimals: await lpContract.decimals(),
  };

  const token0Contract = new ethers.Contract(lpPair.token0, ERC20ABI, deployer);
  const token0 = {
    symbol: await token0Contract.symbol(),
  };

  const token1Contract = new ethers.Contract(lpPair.token1, ERC20ABI, deployer);
  const token1 = {
    symbol: await token1Contract.symbol(),
  };

  const resolveSwapRoute = (input, proxies, preferredProxy, output) => {
    if (input === output) return [input];
    if (proxies.includes(output)) return [input, output];
    if (proxies.includes(preferredProxy))
      return [input, preferredProxy, output];
    return [input, proxies.filter(input)[0], output];
  };

  await hardhat.run("compile");

  const vault = new ethers.Contract(vaultAddress, mofiVaultABI, deployer);
  const Strategy = await ethers.getContractFactory(strategyContractName);

  const strategyParams = {
    want: lpPair.address,
    poolId: poolId,
    vault: vault.address,
    unirouter: solar.router,
    keeper: mofi.keeper,
    mofiFeeRecipient: mofi.mofiFeeRecipient,
    outputToNativeRoute: [SOLAR.address, WMOVR.address],
    // Check this before deploy, on some routes it is better to write by yourself
    outputToLp0Route: resolveSwapRoute(
      SOLAR.address,
      baseTokenAddresses,
      lpPair.token1,
      lpPair.token0,
    ),
    outputToLp1Route: resolveSwapRoute(
      SOLAR.address,
      baseTokenAddresses,
      lpPair.token0,
      lpPair.token1,
    ),
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

  await vault.proposeStrat(strategy.address);

  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

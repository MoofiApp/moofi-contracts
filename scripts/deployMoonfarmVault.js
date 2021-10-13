const hardhat = require("hardhat");

const ERC20ABI = require("../abis/ERC20.json");
const masterchefABI = require("../abis/IMasterChef.json");
const LPPairABI = require("../abis/IUniswapV2Pair.json");

const { addressBook } = require("moofi-addressbook");
const { mofi, moonfarm } = addressBook.moonriver.platforms;
const { MOON, WMOVR, USDC } = addressBook.moonriver.tokens;
const baseTokenAddresses = [MOON, WMOVR, USDC].map((t) => t.address);

const ethers = hardhat.ethers;

// Change on deploy
const poolId = 34;

async function main() {
  const deployer = await ethers.getSigner();

  const masterchefContract = new ethers.Contract(
    moonfarm.masterchef,
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

  const mooPairName = `${token0.symbol}-${token1.symbol}`;

  const vaultParams = {
    name: `Mii Moonfarm ${mooPairName}`,
    symbol: `miiMoonfarm${mooPairName}`,
    delay: 21600,
  };

  const contractNames = {
    vault: "MofiVault",
    strategy: "StrategyMoonChefLP",
  };

  console.log(vaultParams, contractNames);

  if (
    Object.values(vaultParams).some((v) => v === undefined) ||
    Object.values(contractNames).some((v) => v === undefined)
  ) {
    console.error("one of config values undefined");
    return;
  }

  await hardhat.run("compile");

  const Vault = await ethers.getContractFactory(contractNames.vault);
  const Strategy = await ethers.getContractFactory(contractNames.strategy);

  console.log("Deploying:", vaultParams.name);

  const vault = await Vault.deploy(...Object.values(vaultParams));
  await vault.deployed();

  console.log("Vault deployed to:", vault.address);

  const strategyParams = {
    want: lpPair.address,
    poolId: poolId,
    vault: vault.address,
    unirouter: moonfarm.router,
    keeper: mofi.keeper,
    mofiFeeRecipient: mofi.mofiFeeRecipient,
    outputToNativeRoute: [MOON.address, WMOVR.address],
    // Check this before deploy, on some routes it is better to write by yourself
    outputToLp0Route: resolveSwapRoute(
      MOON.address,
      baseTokenAddresses,
      lpPair.token1,
      lpPair.token0,
    ),
    outputToLp1Route: resolveSwapRoute(
      MOON.address,
      baseTokenAddresses,
      lpPair.token0,
      lpPair.token1,
    ),
  };

  if (Object.values(strategyParams).some((v) => v === undefined)) {
    console.error("one of config values undefined");
    return;
  }

  const strategy = await Strategy.deploy(...Object.values(strategyParams));
  await strategy.deployed();

  console.log("Strategy deployed to:", strategy.address);
  console.log("Mofi App object:", {
    id: `moonfarm-${mooPairName.toLowerCase()}`,
    name: `${mooPairName} LP`,
    token: `${mooPairName} MLP`,
    tokenDescription: "Moonfarm",
    tokenAddress: strategyParams.want,
    tokenDecimals: lpPair.decimals,
    tokenDescriptionUrl: "#",
    earnedToken: vaultParams.symbol,
    earnedTokenAddress: vault.address,
    earnContractAddress: vault.address,
    pricePerFullShare: 1,
    tvl: 0,
    oracle: "lps",
    oracleId: `moonfarm-${mooPairName.toLowerCase()}`,
    oraclePrice: 0,
    depositsPaused: false,
    status: "active",
    platform: "Moonfarm",
    assets: [token0.symbol, token1.symbol],
    addLiquidityUrl: `https://swap.moonswap.in/#/add/${lpPair.token0}/${lpPair.token1}`,
    buyTokenUrl: `https://swap.moonswap.in/swap?inputCurrency=${lpPair.token0}&outputCurrency=${lpPair.token1}`,
    platformUrl: "https://swap.moonswap.in/",
    harvestFrequency: 86400,
  });

  const tx = await vault.initializeStrat(strategy.address);
  console.log("Initialized Strat", strategy.address, tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

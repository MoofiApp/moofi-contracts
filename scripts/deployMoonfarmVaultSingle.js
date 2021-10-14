const hardhat = require("hardhat");

const ERC20ABI = require("../abis/ERC20.json");
const masterchefABI = require("../abis/IMasterChef.json");

const { addressBook } = require("moofi-addressbook");
const { mofi, moonfarm } = addressBook.moonriver.platforms;
const { MOON, WMOVR, USDC } = addressBook.moonriver.tokens;
const baseTokenAddresses = [MOON, WMOVR, USDC].map((t) => t.address);

const ethers = hardhat.ethers;

// Change on deploy
const poolId = 2;

async function main() {
  const deployer = await ethers.getSigner();

  const masterchefContract = new ethers.Contract(
    moonfarm.masterchef,
    masterchefABI,
    deployer,
  );
  const poolInfo = await masterchefContract.poolInfo(poolId);
  const token = ethers.utils.getAddress(poolInfo.lpToken);

  const tokenContract = new ethers.Contract(token, ERC20ABI, deployer);
  const tokenDecimals = await tokenContract.decimals();
  const tokenSymbol = await tokenContract.symbol();

  const resolveSwapRoute = (input, proxies, output) => {
    if (input === output) return [input];
    if (proxies.includes(output)) return [input, output];
    return [input, proxies.filter(input)[0], output];
  };

  const vaultParams = {
    name: `Mii Moonfarm ${tokenSymbol}`,
    symbol: `miiMoonfarm${tokenSymbol}`,
    delay: 21600,
  };

  const contractNames = {
    vault: "MofiVault",
    strategy: "StrategyMoonChefSingle",
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
    want: token,
    poolId: poolId,
    vault: vault.address,
    unirouter: moonfarm.router,
    keeper: mofi.keeper,
    mofiFeeRecipient: mofi.mofiFeeRecipient,
    outputToNativeRoute: [MOON.address, WMOVR.address],
    outputToWantRoute: resolveSwapRoute(
      MOON.address,
      baseTokenAddresses,
      token,
    )
  };

  if (Object.values(strategyParams).some((v) => v === undefined)) {
    console.error("one of config values undefined");
    return;
  }

  const strategy = await Strategy.deploy(...Object.values(strategyParams));
  await strategy.deployed();

  console.log("Strategy deployed to:", strategy.address);
  console.log("Mofi App object:", {
    id: `moonfarm-${tokenSymbol.toLowerCase()}`,
    name: tokenSymbol,
    token: `moonfarm${tokenSymbol}`,
    tokenDescription: "Moonfarm",
    tokenAddress: strategyParams.want,
    tokenDecimals: tokenDecimals,
    tokenDescriptionUrl: "#",
    earnedToken: vaultParams.symbol,
    earnedTokenAddress: vault.address,
    earnContractAddress: vault.address,
    pricePerFullShare: 1,
    tvl: 0,
    oracle: "tokens",
    oracleId: tokenSymbol,
    oraclePrice: 0,
    depositsPaused: false,
    status: "active",
    platform: "Moonfarm",
    assets: [tokenSymbol],
    buyTokenUrl: `https://swap.moonswap.in/swap?outputCurrency=${token}`,
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

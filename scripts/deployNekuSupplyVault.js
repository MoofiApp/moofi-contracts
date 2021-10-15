const hardhat = require("hardhat");

const ERC20ABI = require("../abis/ERC20.json");
const INTokenABI = require("../abis/INToken.json");
const masterchefABI = require("../abis/IMasterChef.json");

const { addressBook } = require("moofi-addressbook");
const { mofi, solar, neku } = addressBook.moonriver.platforms;
const { SOLAR, WMOVR, USDC, NEKU } = addressBook.moonriver.tokens;
const baseTokenAddresses = [SOLAR, WMOVR, USDC].map((t) => t.address);

const ethers = hardhat.ethers;

// Change on deploy
const poolId = 5;

// 5 - dai

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

  const vaultParams = {
    name: `Mii Neku ${tokenSymbol}`,
    symbol: `miiNeku${tokenSymbol}`,
    delay: 21600,
  };

  const contractNames = {
    vault: "MofiVault",
    strategy: "StrategyNekuSingle",
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
    nToken: nToken,
    poolId: poolId,
    vault: vault.address,
    unirouter: solar.router,
    keeper: mofi.keeper,
    mofiFeeRecipient: mofi.mofiFeeRecipient,
    outputToNativeRoute: [NEKU.address, USDC.address, WMOVR.address],
    outputToWantRoute: [NEKU.address, USDC.address, token]
  };

  if (Object.values(strategyParams).some((v) => v === undefined)) {
    console.error("one of config values undefined");
    return;
  }

  // const strategy = await Strategy.deploy(...Object.values(strategyParams), { gasLimit: 1000000  });
  const strategy = await Strategy.deploy(...Object.values(strategyParams));
  await strategy.deployed();

  console.log("Strategy deployed to:", strategy.address);
  console.log("Mofi App object:", {
    id: `neku-${tokenSymbol.toLowerCase()}`,
    name: tokenSymbol,
    token: `NEKU ${tokenSymbol}`,
    tokenDescription: "Neku",
    tokenAddress: token,
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
    platform: "Neku",
    assets: [tokenSymbol],
    buyTokenUrl: `https://app.solarbeam.io/exchange/swap?outputCurrency=${token}`,
    platformUrl: "https://www.neku.io/",
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

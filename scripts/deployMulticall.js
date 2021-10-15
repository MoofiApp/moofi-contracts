const hardhat = require("hardhat");

const ethers = hardhat.ethers;

async function main() {
  const deployer = await ethers.getSigner();

  await hardhat.run("compile");

  const Multicall = await ethers.getContractFactory("Multicall2");

  console.log("Deploying Multicall...");

  const multicall = await Multicall.deploy();
  await multicall.deployed();

  console.log("Multicall deployed to:", multicall.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const hardhat = require("hardhat");

const ethers = hardhat.ethers;

async function main() {
  const deployer = await ethers.getSigner();

  await hardhat.run("compile");

  const TimelockController = await ethers.getContractFactory("TimelockController");

  const timelockParams = {
    minDelay: 21600,
    proposers: ["0x5DF70B08A3377AC0B9F5291Ad156Ab6e30622166"],
    executors: ["0x8784279bdB1b634d5bEf86C92262D1775248aEE0", "0x5DF70B08A3377AC0B9F5291Ad156Ab6e30622166", "0x6648B5554632Ed5d6Ec27Ec6737e98A0A3DBbc94"]
  };

  if (Object.values(timelockParams).some((v) => v === undefined)) {
    console.error("one of config values undefined");
    return;
  }

  console.log("Deploying...");

  const timelock = await TimelockController.deploy(...Object.values(timelockParams));
  await timelock.deployed();

  console.log("Timelock deployed to:", timelock.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

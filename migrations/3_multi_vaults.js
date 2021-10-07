const MofiPriceMulticall = artifacts.require("MofiPriceMulticall");
const MofiStrategyMulticall = artifacts.require("MofiStrategyMulticall");
const MofiLastHarvestMulticall = artifacts.require("MofiLastHarvestMulticall");
const Multicall = artifacts.require("Multicall");

module.exports = function (deployer) {
  deployer.deploy(MofiPriceMulticall);
  deployer.deploy(MofiStrategyMulticall);
  deployer.deploy(MofiLastHarvestMulticall);
  deployer.deploy(Multicall);
};

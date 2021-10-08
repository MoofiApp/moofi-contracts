const Migrations = artifacts.require("Migrations");

module.exports = function (deployer, _1, accounts) {
  deployer.deploy(Migrations);
};

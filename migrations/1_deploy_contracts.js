var Arbitrage = artifacts.require("ArbitrageBot");

module.exports = async function (deployer) {
  await deployer.deploy(Arbitrage);
};

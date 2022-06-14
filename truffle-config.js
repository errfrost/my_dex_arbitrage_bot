//const HDWalletProvider = require('@truffle/hdwallet-provider');
//const mnemonic = 'practice bargain mobile drink junk never cigar winner morning trophy vague response';

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*" // Match any network id
    },
    dashboard: {
        port: 25012,
        host: "localhost"
      }/*,
    //старая схема, когда нужно было самостоятельно прописывать сети
    bsc: {
      provider: () => new HDWalletProvider(
        mnemonic,
        'https://bsc-dataseed.binance.org/'
      ),
      network_id: 56,
      skipDryRun: true
    },
    bscTestnet: {
      provider: () => new HDWalletProvider(
        mnemonic,
        'https://data-seed-prebsc-1-s1.binance.org:8545'
      ),
      network_id: 97,
      skipDryRun: true
    }*/
  },
  compilers: {
    solc: {
      version: "0.8.11"
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
}

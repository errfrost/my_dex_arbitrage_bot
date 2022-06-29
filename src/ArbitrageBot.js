import {React, useState} from 'react';
import {ethers} from 'ethers';
import abi from './ArbitrageBot.json';

const ArbitrageBot = () => {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [swapDetails, setSwapDetails] = useState(null);
  const [stopBot, setStopBot] = useState(false);

  console.log('rerender ' + stopBot);

  let inTrade = false;
  let currentRoute = 0;
  let currentRouter1 = 0;
  let currentRouter2 = 1;
  let currentToken = 0;
//  let stopT = false;
  let decimalsMainToken = 18;

  const config = require('./fantom.json');
  const walletConfig = require('./wallet.json');
  const ERC20ABI = require('./ERC20.json');

  const chainToken = config.chainToken;
  const stableCoin = config.baseAssets[0].sym;
  const botContractAddress = config.arbContract;//trading bot smart contract address
  const usdtTokenAddress = config.baseAssets[0].address;//bsc testnet busd address //0x4988a896b1227218e4A686fdE5EabdcAbd91571f';

  const updateEthers = (e) => {
    e.preventDefault();

    //connecting to RPC - ethereum node
    let providerRPC = walletConfig.rpcFantomOpera;

    let tempProvider = new ethers.providers.JsonRpcProvider(providerRPC);
    setProvider(tempProvider);

    //checking if we connected to RPC
    tempProvider.getBlockNumber().then((result) => {
      console.log("Current block number: " + result);
    });

  }

  //connecting to our wallet
  const connectWallet = async (e) => {
    e.preventDefault();

    let privateKey = walletConfig.privateKey;
    let tempWallet = new ethers.Wallet(privateKey, provider);
    privateKey = '';
    setWallet(tempWallet);

    console.log('Connected wallet: ' + tempWallet.address);

    //connecting to our ArbitrageBot smart contract
    //let signer = tempWallet.provider.getSigner(tempWallet.address);
    //for correct working we need to sign transaction with the wallet object, not the signer
    let tempContract = new ethers.Contract(config.arbContract, abi.abi, tempWallet);
    setContract(tempContract);
  }

  //get balance of tokenAddress in contract wallet
  const getTokenBalance = async (tokenAddress) => {
    const newContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    const botBalanceTradingToken = await newContract.balanceOf(botContractAddress);
    return botBalanceTradingToken;
  }

  const getStableCoinBalances = async (e) => {
    e.preventDefault();

    const newContract = new ethers.Contract(usdtTokenAddress, ERC20ABI, provider);
    const walletBalanceTradingToken = await newContract.balanceOf(wallet.address);
    const botBalanceTradingToken = await newContract.balanceOf(botContractAddress);
    decimalsMainToken = await newContract.decimals();
    console.log(stableCoin + ' decimals = ' + decimalsMainToken);

    let currentGasPrice = await provider.getFeeData();
    currentGasPrice = currentGasPrice.gasPrice;
    let currentGasPriceInGwei = ethers.utils.formatUnits(currentGasPrice, config.decimals-9);
    console.log('Gas Price = ' + currentGasPrice + ' _ ' + currentGasPriceInGwei); // по идее decimalsMainToken тут должен быть того токена. который используется для газа

    console.log(stableCoin + ' Tokens in wallet: ' + ethers.utils.formatUnits(walletBalanceTradingToken, decimalsMainToken));
    console.log(stableCoin + ' Tokens in contract: ' + ethers.utils.formatUnits(botBalanceTradingToken, decimalsMainToken));
  }

  //get ETH(BNB) balance of connected account
  const getGasBalance = async (e) => {
    e.preventDefault();
    let balanceWallet = await wallet.getBalance()/Math.pow(10, 18);
    let balanceContract = await provider.getBalance(botContractAddress)/Math.pow(10, 18);

    console.log(chainToken + ' balance in wallet: ' + balanceWallet);
    console.log(chainToken + ' balance in contract: ' + balanceContract);
    setWalletBalance(balanceWallet);
  }

  const lookForDualTrade = async (e) => {
    if (e != null) e.preventDefault();
    console.log(stopBot);
    if (stopBot === true) {
      //setStopBot(false);
      return;
    }

    //chosing the routes and tokens to trade
    const targetRoute = {};
    const route = config.routes[currentRoute];

    //using routes array to trade algorithm
    currentRoute += 1;
    if (currentRoute >= config.routes.length) currentRoute = 0;

    targetRoute.router1 = route[0];
    targetRoute.router2 = route[1];
    targetRoute.token1 = route[2];
    targetRoute.token2 = route[3];

    //one by one route algorithm
    currentToken += 1;
    if (currentToken >= config.tokens.length) {
      currentToken = 0;
      currentRouter2 += 1;
    }
    if (currentRouter2 >= config.routers.length) {
      currentRouter1 += 1;
      currentRouter2 = 0;
    }
    if (currentRouter1 >= config.routers.length) {
      currentRouter1 = 0;
    }
    if (currentRouter2 === currentRouter1) {
      currentRouter2 += 1;
    }
    if (currentRouter2 >= config.routers.length) {
      currentRouter2 = 0;
    }

    targetRoute.router1 = config.routers[currentRouter1].address;
    targetRoute.router2 = config.routers[currentRouter2].address;
    targetRoute.token1 = config.baseAssets[0].address;
    targetRoute.token2 = config.tokens[currentToken].address;


    try {
      let tradeSize = await getTokenBalance(targetRoute.token1);
      if (tradeSize === 0) {
          console.log('Insufficient funds to trade');
          return;
      }

      const amtBack = await contract.estimateDualDexTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);

      let profit =  (amtBack-tradeSize)/Math.pow(10, decimalsMainToken);
      setSwapDetails(config.tokens[currentToken].sym + '(' + config.routers[currentRouter1].dex
                                      + '-' + config.routers[currentRouter2].dex + ') ' + profit + ' ' + stableCoin);
      let profitString = '';
      if (profit > 0) {
        let currentGasPrice = await provider.getFeeData();
        currentGasPrice = currentGasPrice.gasPrice;
        let currentGasPriceInGwei = ethers.utils.formatUnits(currentGasPrice, config.decimals-9);
        let transactionFee = ethers.utils.formatUnits(currentGasPrice, config.decimals) * 280000;

        profitString = '----->   PROFIT!   Gas Price = ' + currentGasPriceInGwei + ' gwei -> ' + transactionFee;

        const current = new Date();
        const date = `${current.getHours()}:${current.getMinutes()}:${current.getSeconds()}`;

        console.log(date + ' Trade log: ' + config.tokens[currentToken].sym + '(' + config.routers[currentRouter1].dex
                                + '-' + config.routers[currentRouter2].dex + ') ' + profit + ' ' + stableCoin + profitString);

        if ((profit-transactionFee>=0.01) && (currentGasPriceInGwei < 100)) {
          await dualTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize, currentGasPriceInGwei);
        } else {
          await lookForDualTrade(null);
        }

      } else {
        await lookForDualTrade(null);
      }

    } catch (error) {
      await lookForDualTrade(null);
    }

  }

  const dualTrade = async (router1, router2, baseToken, token2, amount, gas) => {
    if (inTrade === true) {
      await lookForDualTrade(null);
      return false;
    }

    try {
      inTrade = true;
      console.log('> Making dualTrade...');
      //uncomment code below to make real trade
      const tx = await contract.dualDexTrade(router1, router2, baseToken, token2, amount,
                                              {gasPrice: ethers.utils.parseUnits(gas, 'gwei'), gasLimit: 280000});
      console.log(tx);
      let receipt = await tx.wait();
      console.log('> Successeful transaction');
      console.log('Result - > ' + receipt);
      inTrade = false;

      console.log('amount = ' + amount.toString());
      console.log('Dex1 - ' + router1);
      console.log('Dex2 - ' + router2);
      console.log('Token1 - ' + baseToken);
      console.log('Token2 - ' + token2);
      console.log(' ');

      //comment code below to loop trade process
      setStopBot(true);

      await lookForDualTrade(null);
    } catch (error) {
      console.log('catch error - begin');
      console.log(error.transaction);
      console.log(error.transactionHash);
      console.log(error.receipt);
      console.log('catch error - end');
      inTrade = false;
      await lookForDualTrade(null);
    }
  }

  const stopTrade = async (e) => {
    e.preventDefault();
    setStopBot(true);
    console.log('-------STOP-------' + stopBot);
  }

  const recoverGas = async (e) => {
    e.preventDefault();

    try {
      console.log(contract);
      const tx = await contract.recoverEth();
      await tx.wait();
    } catch (e) {
      console.log(e);
    }
  }

  const recoverTokens = async (e) => {
    e.preventDefault();

    try {
      const tx = await contract.recoverTokens(usdtTokenAddress);
      await tx.wait();
    } catch (e) {
      console.log(e);
    }
  }



  return (
    <div>
      <strong>ArbitrageBot</strong>
      <br/><br/>

      Connections
      <form onSubmit={updateEthers}>
        <button type='submit'>Connect to BlockChain</button>
      </form>

      <form onSubmit={connectWallet}>
        <button type='submit'>Connect wallet</button>
      </form>
      <br/>

      Wallet Balance - {walletBalance}
      <form onSubmit={getGasBalance}>
        <button type='submit'>Get Wallet Balance</button>
      </form>

      <form onSubmit={getStableCoinBalances}>
        <button type='submit'>Get {stableCoin} wallet Balance</button>
      </form>
      <br/>

      Arbitrage
      <form onSubmit={lookForDualTrade}>
        <button type='submit'>Search for Arbitrage Opportunities</button> {swapDetails}
      </form>
      <form onSubmit={stopTrade}>
        <button type='submit'>Stop</button>
      </form>
      <br/>

      Get back your money
      <form onSubmit={recoverGas}>
        <button type='submit'>Recover Gas from Contract to Owner</button>
      </form>
      <form onSubmit={recoverTokens}>
        <button type='submit'>Recover Tokens from Contract to Owner</button>
      </form>
    </div>
  )
}

export default ArbitrageBot;

import Web3 from 'web3';
import Bitcoin from 'bitcoin';
import KeyStore from 'node-ethereumjs-keystore';
import {Wallet} from './wallet';
import {Transaction} from './transaction';
import {Withdrawal} from './withdrawal';
import {Balance, Long} from './balance';
import {BalanceChange} from './balance_change';
import {Setting} from './setting';
import logger from '../logger';

export default class CryptoClient {
  constructor(id, config) {
    this.currId   = id;
    this.config   = config;
    this.type     = config.type;
    this.confReq  = config.confReq;
    this.currName = config.name;
    this.netFee   = config.netFee || 0;
    if (this.type === 'eth') {
      this.ethKeyStore = new KeyStore();
      this.ethFilter = null;
      this.gas = config.gas;
      this.gasPrice = config.gasPrice;
    }
    this.initClient();
  }

  ethWatcher(error, log) {
    if (error) return logger.error("ethWatcher", error);
    let block = this._client.eth.getBlock(log, true);
    if (!block) return;
    let {number, transactions} = block;
    this.moveDeposits(number);

    if (!transactions || transactions.length === 0) return;
    for (let tx of transactions) {
      let {blockNumber, hash, from, to, value} = tx;
      if (value.toNumber() === 0) continue;
      Transaction.findOne({
        txid:   hash,
        currId: this.currId
      }).then((found) => {
        if (found) return logger.error('tx already in db', txError, found);
        return Wallet.findOne({currId: this.currId, address: to});
      }).then((wallet) => {
        if (!wallet) return false;
        logger.info(`Incoming tx to ${to}: ${value.toNumber() / Math.pow(10, 18)} (${hash})`)
        Transaction.newDeposit(tx, wallet, this.confReq);
      });
    }
    if (this.lastBlock < block.number) {
      this.lastBlock = block.number;
      Setting.set('ethLastBlock', block.number);
    }
  }

  moveDeposits(blockNumber) {
    Transaction.aggregate([
      {
        $match: {
          currId: this.currId,
          moved: { $ne: true },
          balanceChangeId: { $ne: null },
          amount: { $gt: this.netFee * 10 }
        }
      },
      {
        $group: {
          _id: "$walletId",
          amount: { $sum: "$amount" }
        }
      }
    ]).then((items) => {
      for (let item of items) {
        Wallet.findOne({_id: item._id}).then((wallet) => {
          let {address, secret} = wallet;
          this.ethKeyStore.importKey(secret);
          let gas = Long.fromNumber(this.gas);
          let gasPrice = Long.fromNumber(this.gasPrice);
          let fee = gas.mul(gasPrice);
          let rawTx = {
            to:   this.hotAddress,
            from: address,
            gas:  this.gas.toString(16),
            gasPrice: this.gasPrice.toString(16),
            amount: item.amount.subtract(fee)
          }
          let signedTx = this.ethKeyStore.signTransaction(txParams);
          this._client.eth.sendRawTransaction(signedTx, (error, hash) => {
            if (error) return logger.error("moveDeposit", error);
            logger.info(`Stashed ${item.amount.toNumber()/Math.pow(10,8)} from ${address} to the hot wallet`);
          })
        });
      }
    });
  }

  initClient() {
    try {
      switch (this.type) {
        case 'eth':
          let web3 = this._client = new Web3();
          let url = `http://${this.config.rpc.host}:${this.config.rpc.port}`;
          web3.setProvider(new web3.providers.HttpProvider(url));
          this.ethFilter = web3.eth.filter('latest');
          Setting.get('ethLastBlock').then((ethLastBlock) => {
            this.lastBlock = ethLastBlock ? ethLastBlock.value : 0;
            logger.info(`Last processed eth block: ${this.lastBlock}, latest ethereum block: ${web3.eth.blockNumber}`);
            if (this.lastBlock < web3.eth.blockNumber && !process.env.ETH_SKIP_CATCHUP) {
              logger.info('last processed block is too old, catching up');
              for (let blockNumber = this.lastBlock; blockNumber < web3.eth.blockNumber; blockNumber++) {
                logger.info(`processing block ${blockNumber} of ${web3.eth.blockNumber}`);
                this.ethWatcher(null, blockNumber);
              }
            }
            this.ethFilter.watch(this.ethWatcher.bind(this));
          });
          break;
        default:
          this._client = new Bitcoin.Client(this.config.rpc);
          break;
      }
    } catch (error) {
      logger.error('initClient', error);
      callback(error);
    }
  }

  getBalance(callback) {
    try {
      switch (this.type) {
        case 'eth':
          callback(null, this._client.eth.getBalance(this._client.eth.coinbase).toNumber());
          break;
        default:
          this._client.getBalance(callback);
          break;
      }
    } catch (error) {
      // logger.error('getBalance', error);
      callback(error);
    }
  }

  getNewAddress(callback) {
    try {
      switch (this.type) {
        case 'eth':
          let key = this.ethKeyStore.newAccount();
          callback(null, "0x" + key.address, key.secretKey.toString('hex'));
          break;
        default:
          this._client.getNewAddress((err, address, secret) => {
            console.log(err, address, secret);
            callback(err, address);
          });
          break;
      }
    } catch (error) {
      logger.error('getNewAddress', error);
      callback(error);
    }
  }

  listTransactions(numConf, batch, skip, callback) {
    try {
      switch (this.type) {
        case 'eth':
          // stub
          break;
        default:
          this._client.listTransactions(numConf, batch, skip, callback);
          break;
      }
    } catch (error) {
      // logger.error('listTransactions', error);
      callback(error);
    }
  }

  sendToAddress(address, amount, callback) {
    try {
      switch (this.type) {
        case 'eth':
          let txid = this._client.eth.sendTransaction({to: address, value: amount});
          txid ? callback(null, txid) : callback(new Error('unable to send transaction'));
          break;
        default:
          this._client.sendToAddress(address, amount, callback);
          break;
      }
    } catch (error) {
      logger.error('sendToAddress', error);
      callback(error);
    }
  }

  getTransaction(txid, callback) {
    try {
      switch (this.type) {
        case 'eth':
          callback(null, this._client.eth.getTransaction(txid));
          break;
        default:
          this._client.getTransaction(txid, callback);
          break;
      }
    } catch (error) {
      logger.error('getTransaction', error);
      callback(error);
    }
  }
}

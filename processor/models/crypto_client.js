import Web3 from 'web3';
import Bitcoin from 'bitcoin';
import KeyStore from 'node-ethereumjs-keystore';
import {Wallet} from './wallet';
import {Transaction} from './transaction';
import {Withdrawal} from './withdrawal';
import {Balance} from './balance';
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
    if (this.type === 'eth') {
      this.ethKeyStore = new KeyStore();
      this.ethFilter = null;
    }
    this.initClient();
  }

  ethWatcher(error, log) {
    if (error) return logger.error(error);
    let block = this._client.eth.getBlock(log, true);
    if (!block) return;
    let {transactions} = block;
    if (!transactions || transactions.length === 0) return;
    for (let tx of transactions) {
      let {blockNumber, hash, from, to, value} = tx;
      if (value.toNumber() === 0) continue;
      Transaction.findOne({
        txid: hash
      }).then((found) => {
        if (found) return logger.error('tx already in db', txError, found);
        return Wallet.findOne({address: to});
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

  initClient() {
    switch (this.type) {
      case 'eth':
        let web3 = this._client = new Web3();
        let url = `http://${this.config.rpc.host}:${this.config.rpc.port}`;
        web3.setProvider(new web3.providers.HttpProvider(url));
        this.ethFilter = web3.eth.filter('latest');
        Setting.get('ethLastBlock').then((ethLastBlock) => {
          this.lastBlock = ethLastBlock ? ethLastBlock.value : 0;
          logger.info(`Last processed eth block: ${this.lastBlock}, latest ethereum block: ${web3.eth.blockNumber}`);
          if (this.lastBlock < web3.eth.blockNumber) {
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
  }

  getBalance(callback) {
    switch (this.type) {
      case 'eth':
        callback(null, this._client.eth.getBalance(this._client.eth.coinbase).toNumber());
        break;
      default:
        this._client.getBalance(callback);
        break;
    }
  }

  getNewAddress(callback) {
    switch (this.type) {
      case 'eth':
        let key = this.ethKeyStore.newAccount();
        callback(null, "0x" + key.address, key.secretKey.toString('hex'));
        break;
      default:
        this._client.getNewAddress(callback);
        break;
    }
  }

  listTransactions(numConf, batch, skip, callback) {
    switch (this.type) {
      case 'eth':
        // stub
        break;
      default:
        this._client.listTransactions(numConf, batch, skip, callback);
        break;
    }
  }

  sendToAddress(address, amount, callback) {
    switch (this.type) {
      case 'eth':
        let txid = this._client.eth.sendTransaction({to: address, value: amount});
        txid ? callback(null, txid) : callback(new Error('unable to send transaction'));
        break;
      default:
        this._client.sendToAddress(address, amount, callback);
        break;
    }
  }

  getTransaction(txid, callback) {
    switch (this.type) {
      case 'eth':
        callback(null, this._client.eth.getTransaction(txid));
        break;
      default:
        this._client.getTransaction(txid, callback);
        break;
    }
  }
}

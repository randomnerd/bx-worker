import Web3 from 'web3';
import Bitcoin from 'bitcoin';
import KeyStore from 'node-ethereumjs-keystore';

export default class CryptoClient {
  constructor(id, config) {
    this.currId   = id;
    this.config   = config;
    this.type     = config.type;
    this.confReq  = config.confReq;
    this.currName = config.name;
    this.ethKeyStore = new KeyStore();
    this.initClient();
  }

  initClient() {
    switch (this.type) {
      case 'eth':
        let web3 = this._client = new Web3();
        web3.setProvider(new web3.providers.HttpProvider(this.config.rpc));
        break;
      default:
        this._client = new Bitcoin.Client(this.config.rpc);
        break;
    }
  }

  getBalance(callback) {
    switch (this.type) {
      case 'eth':
        callback(null, this._client.eth.getBalance(this._client.eth.coinbase));
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
        callback(null, key);
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
        callback(null, this._client.eth.getTransactionByHash(txid));
        break;
      default:
        this._client.getTransaction(txid, callback);
        break;
    }
  }
}

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
    this.ethFilter = null;
    this.lastBlock = 0;
    this.initClient();
  }

  ethWatcher(error, log) {
    if (error) return console.log(error);
    let block = this._client.eth.getBlock(log, true);
    if (!block) return;
    let {transactions} = block;
    if (!transactions || transactions.length === 0) return;
    for (let tx of transactions) {
      let {blockNumber, hash, from, to, value} = tx;
      if (!value) continue;
      // check if address is in database
      // check confirmation requirements
      // add to balance
    }
    if (this.lastBlock < block.number) this.lastBlock = block.number;
  }

  initClient() {
    switch (this.type) {
      case 'eth':
        let web3 = this._client = new Web3();
        let url = `http://${this.config.rpc.host}:${this.config.rpc.port}`;
        web3.setProvider(new web3.providers.HttpProvider(url));
        this.ethFilter = web3.eth.filter('latest');
        this.ethFilter.watch(this.ethWatcher.bind(this));
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
        callback(null, key.address, key.secretKey.toString('hex'));
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

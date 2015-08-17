import bitcoin from 'bitcoin'
import {BaseWorker} from './base'
import Random from 'meteor-random'
import Big from 'big.js'

export class WalletWorker extends BaseWorker {
  init() {
    this.name = 'WalletWorker';
    this.configName = 'wallet';
    this.clients = {};
  }

  startClient(id, config) {
    this.logger.info('Starting', config.name, 'client')
    let client = this.clients[id] = new bitcoin.Client(config.rpc);
    client.currId = id;
    client.currName = config.name;
    client.getBalance((err, balance) => {
      this.logger.info(config.name, 'balance:', balance)
    })
  }

  startClients() {
    let currs = this.config.currencies;
    for (let id of Object.keys(currs)) {
      this.startClient(id, currs[id])
    }
  }

  start() {
    this.initModels();
    this.startClients();
    super.start();
  }

  stop() {
    this.dropModels();
    super.stop();
  }

  initModels() {
    this.Wallet = this.mongo.model('Wallet', {
      _id: String,
      currId: String,
      userId: String,
      address: String,
      createdAt: Date
    })
  }

  dropModels() {
    delete this.mongo.connection.models.Wallet;
  }

  getJobMap() {
    return {
      newAddress: this.newAddress,
      processDeposits: this.processDeposits
    }
  }

  newAddress(job, callback) {
    let {userId, currId} = job.data;
    let client = this.clients[currId];
    if (!client) {
      // TODO: check user & currency at database
      job.fail("No client configured for currency " + currId);
      return callback();
    }
    client.getNewAddress((err, address) => {
      if (err) {
        job.fail(err.toString())
      } else {
        this.logger.info('New address for user', userId, '/ currency', currId, '/', address);

        let wallet = this.saveWallet(userId, currId, address, (err) => {
          if (err) {
            job.fail(err.toString())
          } else {
            this.logger.info('Address saved with id', wallet.id);
            job.done()
          }
        });
      }
      callback()
    })
  }

  saveWallet(userId, currId, address, cb) {
    let wallet = new this.Wallet({
      _id: Random.id(),
      currId: currId,
      userId: userId,
      address: address,
      createdAt: new Date
    });
    wallet.save(cb.bind(this));
    return wallet;
  }

  processDeposits(job, callback) {
    let curr = this.config.currencies[job.data.currId];
    if (!curr) {
      job.fail('Currency not configured');
      return callback();
    }

    this.logger.info('Processing deposits for', curr.name);
    this._processDeposits(job.data.currId);
    job.done();
    callback();
  }

  _processDeposits(id, skip = 0, batch = 50) {
    let client = this.clients[id];

    client.listTransactions(null, batch, skip, (err, result) => {
      if (err) throw 'Error listing transactions: ' + err;
      if (!result.transactions || result.transactions.length === 0) return;
      for (let tx of result.transactions) {
        if (tx.category !== 'receive') continue;
        this._processDepositTx(client, tx);
      }
      if (result.transactions.length < batch) return;
      this._processDeposits(id, skip + batch, batch);
    })
  }

  _processDepositTx(client, tx) {
    client.getTransaction(tx.txid, (err, result) => {
      let found = 0;
      for (let rawtx of result.details) {
        if (rawtx.category !== 'receive') continue;

        this.Wallet.findOne({address: rawtx.address}, (err, wallet) => {
          if (!wallet) return;
          found += 1;

          this._saveDeposit(tx, rawtx, wallet)
        })
      }
      if (found === 0) {
        // something went wrong, no user wallets found for TX
        // TODO: do something with such TXs: alert admins, etc...
        this.logger.error(
          client.currName, '| amount:', tx.amount, '| txid: ', tx.txid,
          '| transaction did not land into user wallet'
        )
      }
    })
  }

  _saveDeposit(tx, rawtx, wallet) {
    // save deposit
  }

}

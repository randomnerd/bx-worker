import bitcoin from 'bitcoin'
import {BaseWorker} from './base'
import Random from 'meteor-random'

export class WalletWorker extends BaseWorker {
  init() {
    this.name = 'WalletWorker';
    this.configName = 'wallet';
    this.clients = {};
  }

  startClient(id, config) {
    this.logger.info('Starting', config.name, 'client')
    let client = this.clients[id] = new bitcoin.Client(config.rpc);
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
      testjob: this.testjob,
      newAddress: this.newAddress
    }
  }

  testjob(job, callback) {
    this.logger.info('testjob running');
    job.done();
    callback();
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
        job.fail('' + err)
      } else {
        this.logger.info('New address for user', userId, '/ currency', currId, '/', address);

        let wallet = this.saveWallet(userId, currId, address, (err) => {
          if (err) {
            job.fail('' + err)
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
}

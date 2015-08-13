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
    this.startClients();
    super.start();
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
        // TODO: Save new address to database
        job.done();
      }
      callback()
    })
  }
}

import {BaseWorker} from './base'
var bitcoin = require('bitcoin');

export class WalletWorker extends BaseWorker {
  afterCreate() {
    this.name = 'WalletWorker';
    this.clients = {};
    this.config = this.processor.config.get('workers.wallet');
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
      testjob: this.testjob
    }
  }

  testjob(job, callback) {
    this.logger.info('testjob running');
    job.done();
    callback();
  }
}

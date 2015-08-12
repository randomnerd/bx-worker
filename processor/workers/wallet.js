import {BaseWorker} from './base'
var bitcoin = require('bitcoin');

export class WalletWorker extends BaseWorker {
  afterCreate() {
    this.name = 'WalletWorker';
    this.clients = {};
    this.config = this.processor.config.get('workers.wallet');
    this.queues = {};
    this.jobMap = this.getJobMap();
    this.jobTypes = Object.keys(this.jobMap);
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

  startQueues() {
    for (let type of this.jobTypes) {
      let qname = this.config.queueName;
      let params = { pollInterval: 1000000000 };
      this.queues[type] = this.jc.processJobs(qname, type, params, this.jobMap[type].bind(this))
    }
  }

  start() {
    this.logger.info('WalletWorker starting');
    this.startClients();
    this.startQueues();
    super.start();
  }

  stop() {
    this.logger.info('WalletWorker stopping');
    this.stopQueues();
    super.stop();
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

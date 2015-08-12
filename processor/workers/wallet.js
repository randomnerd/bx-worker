import {BaseWorker} from './base'
var bitcoin = require('bitcoin');

export class WalletWorker extends BaseWorker {
  afterCreate() {
    this.name = 'WalletWorker';
    this.clients = {};
    this.workerConfig = this.processor.config.get('workers.wallet');
  }

  startClient(id, config) {
    this.logger.info('Starting', config.name, 'client')
    let client = this.clients[id] = new bitcoin.Client(config.rpc);
    client.getBalance((err, balance) => {
      this.logger.info(config.name, 'balance:', balance)
    })
  }

  startClients() {
    let currs = this.workerConfig.currencies;
    for (let id of Object.keys(currs)) {
      this.startClient(id, currs[id])
    }
  }

  start() {
    this.logger.info('WalletWorker starting');
    this.startClients();
  }

  stop() {
    this.logger.info('WalletWorker stopping');
  }

}

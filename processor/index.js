var JobCollection = require('meteor-job');
import {WalletWorker} from './workers/wallet';

export class Processor {
  constructor(ddp, config, logger) {
    this.jc        = JobCollection;
    this.ddp       = ddp;
    this.config    = config;
    this.logger    = logger;
    this.jobConfig = config.get('jobConfig');
    this.jc.setDDP(this.ddp);

    this.runningWorkers = [];
    this.availableWorkers = [
      WalletWorker
    ]
  }

  start() {
    this.logger.info('Starting job processing');

    this.startWorkers();
  }

  startWorkers() {
    for (var workerClass of this.availableWorkers) {
      var worker = new workerClass(this);
      worker.start();
      this.runningWorkers.push(worker);
    }
  }

  stop() {
    this.observer.stop();
    for (var worker of this.runningWorkers) {
      worker.stop()
    }
  }
}

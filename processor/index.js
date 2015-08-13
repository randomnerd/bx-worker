import JobCollection from 'meteor-job'
import {WalletWorker} from './workers/wallet'
import mongoose from 'mongoose'

export class Processor {
  constructor(ddp, config, logger) {
    this.mongo     = mongoose;
    this.jc        = JobCollection;
    this.ddp       = ddp;
    this.config    = config;
    this.logger    = logger;
    this.jobConfig = config.get('jobConfig');
    this.dbConfig  = config.get('mongoConfig');
    this.jc.setDDP(this.ddp);

    this.runningWorkers = [];
    this.availableWorkers = [
      WalletWorker
    ]
  }

  connectDb() {
    let conf = this.dbConfig;
    let url = `mongodb://${conf.host}:${conf.port}/${conf.dbName}`
    this.mongo.connect(url);
  }

  start() {
    this.logger.info('Starting job processing');
    this.connectDb();
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

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
    this.isRunning = false;
    this.jc.setDDP(this.ddp);

    this.runningWorkers = [];
    this.availableWorkers = [
      WalletWorker
    ]
  }

  connectDb(cb) {
    this.logger.info('Connecting mongo...');
    let conf = this.dbConfig;
    let url = `mongodb://${conf.host}:${conf.port}/${conf.dbName}`
    this.mongo.connect(url, () => {
      this.logger.info('Connected mongo');
      if (typeof cb === 'function') cb()
    });
  }

  disconnectDb(cb) {
    this.logger.info('Disconnecting mongo...');
    this.mongo.disconnect(() => {
      this.logger.info('Disconnected mongo');
      if (typeof cb === 'function') cb()
    });
  }

  start() {
    this.logger.info('Starting job processing');
    this.connectDb(() => {
      this.startWorkers();
      this.isRunning = true;
    })
  }

  startWorkers() {
    for (var workerClass of this.availableWorkers) {
      var worker = new workerClass(this);
      worker.start();
      this.runningWorkers.push(worker);
    }
  }

  stop() {
    for (var worker of this.runningWorkers) {
      worker.stop()
    }
    this.disconnectDb(() => {
      this.isRunning = false;
    });
  }
}

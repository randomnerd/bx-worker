var JobCollection = require('meteor-job');
import {WalletWorker} from './workers/wallet';

export class Processor {
  constructor(ddp, config, logger) {
    this.jc        = JobCollection;
    this.ddp       = ddp;
    this.config    = config;
    this.logger    = logger;
    this.jobConfig = config.get('jobConfig');
    JobCollection.setDDP(this.ddp);

    this.runningWorkers = [];
    this.availableWorkers = [
      WalletWorker
    ]
    this.jobTypeMap = {}
  }

  start() {
    this.logger.info('Starting job processing');

    this.startWorkers();
    this.startObserver();
  }

  startObserver() {
    this.ddp.subscribe(this.jobConfig.queueName);
    this.observer = this.ddp.observe(this.jobConfig.queueName);
    this.observer.added = (id) => {
      this.logger.info('Incoming job', id, ', triggering workers');
      for (let worker of this.runningWorkers) {
        worker.triggerQueues();
      }
    }
    this.observer.changed = () => {}
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

//   function testjob(job, callback) {
//     winston.info('Processing job', job._doc._id, 'with data:', job.data);
//     job.done();
//     callback();
//   };
//
//   function setupWorkers(jc) {
//     // dont poll, only trigger on actual job added
//     q = jc.processJobs(jobConfig.queueName, 'testjob', { pollInterval: 1000000000 }, testjob);
//     var observer = ddp.observe([jobConfig.queueName, jobConfig.collectionName].join('.'));
//     observer.added = function(id) { winston.info('Queued job:', id); q.trigger(); };
//     observer.changed = function() {};
//   };
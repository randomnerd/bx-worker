export class BaseWorker {
  constructor(processor) {
    this.jc        = processor.jc;
    this.ddp       = processor.ddp;
    this.logger    = processor.logger;
    this.processor = processor;

    if (this.afterCreate) this.afterCreate();
  }

  start() {
    throw 'Worker should implement start() method'
  }

  stop() {
    throw 'Worker should implement stop() method'
  }

  registerJobTypes() {
    for (let type of this.jobTypes) {
      if (this.processor.jobTypeMap[type]) {
        throw 'Job type ' + type + ' already registered to ' + this.processor.jobTypeMap[type].name;
      }
      this.processor.jobTypeMap[type] = this;
    }
    this.logger.info(this.name + ' registered for job types: ' + this.jobTypes.join(', '));
  }

  triggerQueues() {
    for (let type of Object.keys(this.queues)) {
      this.queues[type].trigger();
    }
  }

  stopQueues() {
    for (let type of Object.keys(this.queues)) {
      this.queues[type].shutdown();
    }
  }
}

export class BaseWorker {
  constructor(processor) {
    this.jc        = processor.jc;
    this.ddp       = processor.ddp;
    this.logger    = processor.logger;
    this.queues    = {};
    this.processor = processor;

    if (this.afterCreate) this.afterCreate();
  }

  start() {
    this.logger.info(this.name, 'starting');
    this.jobMap = this.getJobMap();
    this.jobTypes = Object.keys(this.jobMap);
    this.startQueues();
    this.startObserver();
  }

  stop() {
    this.logger.info(this.name, 'stopping');
    this.stopObserver();
    this.stopQueues();
  }

  triggerQueues() {
    for (let type of Object.keys(this.queues)) {
      this.queues[type].trigger();
    }
  }

  startQueues() {
    for (let type of this.jobTypes) {
      let qname = this.config.queueName;
      let params = { pollInterval: 1000000000 };
      this.queues[type] = this.jc.processJobs(qname, type, params, this.getJobMap()[type].bind(this))
    }
  }

  stopQueues() {
    for (let type of Object.keys(this.queues)) {
      this.queues[type].shutdown();
    }
  }

  startObserver() {
    this.ddp.subscribe(this.config.queueName);
    this.observer = this.ddp.observe(this.config.queueName);
    this.observer.added = (id) => {
      this.logger.info(this.name, ': incoming job', id);
      this.triggerQueues();
    }
    this.observer.changed = () => {}
  }

  stopObserver() {
    this.observer.stop()
  }
}

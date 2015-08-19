export class BaseWorker {
  constructor(processor) {
    this.jc        = processor.jc;
    this.ddp       = processor.ddp;
    this.mongo     = processor.mongo;
    this.models    = processor.models;
    this.logger    = processor.logger;
    this.queues    = {};
    this.processor = processor;

    this.init();
    try {
      this.config = this.processor.config.get('workers.' + this.configName);
    } catch (e) {
      this.logger.error('No config found for', this.name);
      this.config = {};
    }
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
      this.queues[type].shutdown({quiet: true});
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

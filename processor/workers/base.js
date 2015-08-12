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

  startObserver() {
    this.ddp.subscribe(this.config.queueName);
    this.observer = this.ddp.observe(this.config.queueName);
    this.observer.added = (id) => {
      this.logger.info(this.name, ': incoming job', id);
      this.triggerQueues();
    }
    this.observer.changed = () => {}
  }
}

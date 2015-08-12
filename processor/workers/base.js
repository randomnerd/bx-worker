export class BaseWorker {
  constructor(processor) {
    this.processor = processor;
    this.logger = this.processor.logger;
    this.ddp = this.processor.ddp;

    if (this.afterCreate) this.afterCreate();
  }

  start() {
    throw 'Worker should implement start() method'
  }

  stop() {
    throw 'Worker should implement stop() method'
  }
}

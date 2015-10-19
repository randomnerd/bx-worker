import {BaseWorker} from './base';
import {Withdrawal} from '../models/withdrawal';
import {Order} from '../models/order';
import {Trade} from '../models/trade';
import {OrderBookItem} from '../models/order_book_item';

export class OrderWorker extends BaseWorker {
  init() {
    this.name = 'OrderWorker';
    this.configName = 'order';
    this.clients = {};
  }

  startOrderObserver() {
    this.ddp.subscribe('orderQueue');
    this.orderObserver = this.ddp.observe('orders');
    this.orderObserver.added = (id) => this.processOrder(id);
    this.orderObserver.changed = () => {};
  }

  stopOrderObserver() {
    this.orderObserver && this.orderObserver.stop();
  }

  startObserver() {
    super.startObserver();
    this.startOrderObserver();
  }

  stopObserver() {
    super.stopObserver();
    this.stopOrderObserver();
  }

  getJobMap() {
    return {
    };
  }

  processOrder(id) {
    this.logger.info(`${this.name}: Processing Order ${id}`);
    Order.findOne({_id: id}, (err, order) => {
      order.process();
    })
  }

}

import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;
import Random from 'meteor-random';

import {Order} from '../models/order';
import {OrderBookItem} from '../models/order_book_item';

export default class OrderBookWorker {
  constructor(processor) {
    this.ddp    = processor.ddp;
    this.logger = processor.logger;
    this.book   = {};
  }

  start() {
    this.resetOrders();
    this.startSubscription();
    this.startObserver();
  }

  stop() {
    this.stopSubscription();
    this.stopObserver();
  }

  resetOrders() {
    OrderBookItem.remove({}, (err, ret) => {
      console.log('reset orders', err);
    });
  }

  startSubscription() {
    this.subscription = this.ddp.subscribe('orderQueue');
  }

  stopSubscription() {
    this.subscription && this.subscription.stop();
  }

  startObserver() {
    this.observer         = this.ddp.observe('orders');
    this.observer.added   = this.orderAdded.bind(this);
    this.observer.changed = this.orderChanged.bind(this);
    this.observer.removed = this.orderRemoved.bind(this);
  }

  stopObserver() {
    this.observer && this.observer.stop();
  }

  orderAdded(id) {
    Order.findOne({_id: id}, (err, order) => {
      this.addAmount(order.pairId, order.price, order.remain, order.buy);
    });
  }

  orderChanged(id, oldFields, clearedFields, newFields) {
    let oldRemain = Long.fromNumber(oldFields.remain);
    let price = Long.fromNumber(oldFields.price);
    let newRemain = Long.fromNumber(newFields.remain);
    let change = newRemain.subtract(oldRemain);
    this.addAmount(oldFields.pairId, price, change, oldFields.buy);
  }

  orderRemoved(id, oldValue) {
    console.log('orderRemoved', id, oldValue);
    let amount = Long.fromNumber(oldValue.amount);
    let price = Long.fromNumber(oldValue.price);
    this.addAmount(oldValue.pairId, price, amount.negate(), oldValue.buy);
  }

  marketAmount(price, amount) {
    let order = new Order({amount: amount, price: price});
    return order.marketAmount();
  }

  clearEmpty(pairId) {
    OrderBookItem.remove({
      pairId: pairId,
      amount: Long.fromNumber(0)
    }, (err) => {});
  }

  addAmount(pairId, price, amount, buy) {
    if (typeof amount === 'number') amount = Long.fromNumber(amount);
    let marketAmount = this.marketAmount(amount, price);

    OrderBookItem.findOne({
      pairId: pairId,
      buy:    buy,
      price:  price
    }, (err, item) => {
      if (item) {
        console.log('found', item);
        OrderBookItem.update({_id: item._id}, {
          $inc: {
            amount: amount,
            marketAmount: marketAmount
          }
        }, (err, ret) => {
          this.clearEmpty();
        });
      } else {
        if (amount.lessThanOrEqual(Long.fromNumber(0))) return;
        let item = new OrderBookItem({
          _id:    Random.id(),
          pairId: pairId,
          buy:    buy,
          price:  price,
          amount: amount,
          marketAmount: marketAmount
        });
        item.save((err) => {
          this.clearEmpty(pairId);
        });
      }
    });
  }
}

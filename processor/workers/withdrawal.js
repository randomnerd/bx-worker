import {BaseWorker} from './base';
import {Withdrawal} from '../models/withdrawal';
import logger from '../logger';

export class WithdrawalWorker extends BaseWorker {
  init() {
    this.name = 'WithdrawalWorker';
    this.configName = 'withdrawal';
    this.clients = {};
  }

  startBalanceChangeObserver() {
    this.ddp.subscribe('withdrawalQueue');
    this.balanceChangeObserver = this.ddp.observe('withdrawals');
    this.balanceChangeObserver.added = (id) => this.processWithdrawal(id);
    this.balanceChangeObserver.changed = () => {};
  }

  stopBalanceChangeObserver() {
    this.balanceChangeObserver && this.balanceChangeObserver.stop();
  }

  startObserver() {
    super.startObserver();
    this.startBalanceChangeObserver();
  }

  stopObserver() {
    super.stopObserver();
    this.stopBalanceChangeObserver();
  }

  getJobMap() {
    return {
    };
  }

  processWithdrawal(id) {
    logger.info(`${this.name}: Processing Withdrawal ${id}`);
    this._setStatePending(id, (err, obj) => {
      if (err) return logger.error(err);
      if (!obj) return;
      obj.verify((err, balance) => {
        obj.doBalanceChange();
      })
    });
  }

  _setStatePending(id, callback) {
    Withdrawal.findOneAndUpdate({
      _id: id,
      state: 'initial'
    }, {
      $set: {
        state: 'pending',
        updatedAt: new Date
      }
    }, {
      new: true
    }, callback);
  }

  _setStateApplied(id, callback) {
    Withdrawal.findOneAndUpdate({
      _id: id,
      state: 'pending'
    }, {
      $set: {
        state: 'applied',
        updatedAt: new Date
      }
    }, {
      new: true
    }, callback);
  }

  _setStateDone(id, callback) {
    Withdrawal.findOneAndUpdate({
      _id: id,
      state: 'applied'
    }, {
      $set: {
        state: 'done',
        updatedAt: new Date
      }
    }, {
      new: true
    }, callback);
  }
}

import {BaseWorker} from './base'
import Random from 'meteor-random'
import Big from 'big.js'
import _ from 'underscore'
import {Wallet} from '../models/wallet'
import {Transaction} from '../models/transaction'
import {Notification} from '../models/notification'
import {BalanceChange} from '../models/balance_change'
import {Balance, Long} from '../models/balance'
import {Currency} from '../models/currency'
import {Withdrawal} from '../models/withdrawal'
import async from 'async'

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
    this.balanceChangeObserver.changed = () => {}
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
    }
  }

  processWithdrawal(id) {
    this.logger.info(`${this.name}: Processing Withdrawal ${id}`);
    this._setStatePending(id, (err, obj) => {
      if (err) throw err;
      if (!obj) return;
      obj.doBalanceChange();
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
    }, callback)
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
    }, callback)
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
    }, callback)
  }
}

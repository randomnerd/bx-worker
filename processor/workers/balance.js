import {BaseWorker} from './base'
import Random from 'meteor-random'
import Big from 'big.js'
import _ from 'underscore'
import {Wallet} from '../models/wallet'
import {Transaction} from '../models/transaction'
import {Notification} from '../models/notification'
import {BalanceChange} from '../models/balance_change'
import {Balance, Long} from '../models/balance'

export class BalanceWorker extends BaseWorker {
  init() {
    this.name = 'BalanceWorker';
    this.configName = 'balance';
    this.clients = {};
  }

  startBalanceChangeObserver() {
    this.ddp.subscribe('balanceChangeQueue');
    this.balanceChangeObserver = this.ddp.observe('balance_changes');
    this.balanceChangeObserver.added = (id) => this.processChange(id);
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

  processChange(id) {
    this.logger.info(`${this.name}: Processing BalanceChange ${id}`);
    this._setChangePending(id, (err, change) => {
      if (err) throw err;
      if (!change) return;
      this._applyChange(change);
    });
  }

  _setChangePending(id, callback) {
    BalanceChange.findOneAndUpdate({
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

  _setChangeApplied(id, callback) {
    BalanceChange.findOneAndUpdate({
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

  _setChangeDone(id, callback) {
    BalanceChange.findOneAndUpdate({
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

  _applyChangeToBalance(change, dst) {
    Balance.findOneAndUpdate({
      _id: (dst ? change.dstId : change.srcId),
      pendingChanges: { $ne: change._id }
    }, {
      $inc: {
        amount: (dst ? change.amount : -change.amount)
      },
      $push: { pendingChanges: change._id }
    }, (err, balance) => {
      if (err) throw err;
    })
  }

  _applyChange(change, callback) {
    if (change.srcId) this._applyChangeToBalance(change, false);
    if (change.dstId) this._applyChangeToBalance(change, true);
  }

}

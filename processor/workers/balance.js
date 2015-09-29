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

  _applyChangeToBalance(change, dst, callback) {
    Balance.findOneAndUpdate({
      _id: (dst ? change.dstId : change.srcId),
      pendingChanges: { $ne: change._id }
    }, {
      $inc: {
        amount: (dst ? change.amount : -change.amount)
      },
      $push: { pendingChanges: change._id }
    }, callback);
  }

  _pullChange(changeId, balanceId, callback) {
    Balance.findOneAndUpdate({
      _id: balanceId,
      pendingChanges: changeId
    }, {
      $pull: {
        pendingChanges: changeId
      }
    }, callback);
  }

  _applyChange(change, callback) {
    async.series([
      (cb) => {
        change.srcId ? this._applyChangeToBalance(change, false, cb) : cb(null, null);
      },
      (cb) => {
        change.dstId ? this._applyChangeToBalance(change, true, cb) : cb(null, null);
      },
      (cb) => {
        this._setChangeApplied(change._id, cb);
      },
      (cb) => {
        change.srcId ? this._pullChange(change._id, change.srcId, cb) : cb(null, null);
      },
      (cb) => {
        change.dstId ? this._pullChange(change._id, change.dstId, cb) : cb(null, null);
      },
      (cb) => {
        this._setChangeDone(change._id, cb);
      },
      (cb) => {
        Currency.findOne(change.currId, cb);
      }
    ], (err, result) => {
      if (err) throw err;
      let uids = _.compact(_.pluck(_.compact(result), 'userId'));
      let userId = uids.length && uids[0];
      if (!userId) throw 'No userId found';
      let curr = result[result.length - 1];
      let displayAmount = new Big(change.amount.toString()).div(Math.pow(10, 8)).toString();
      switch (change.subjType) {
        case 'Transaction':
          Notification.notify(userId, '', `${displayAmount} ${curr.shortName} added to your balance`, 'addBalance');
          break;
        case 'Withdrawal':
          Withdrawal.balanceChanged(change.subjId);
          break;
      }
      this.logger.info('Done processing balanceChange', change._id);
    });
  }

}

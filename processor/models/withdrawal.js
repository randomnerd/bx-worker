import mongoose from 'mongoose';
import Job from 'meteor-job';
import {Currency} from './currency';
import {Balance} from './balance';
import {BalanceChange} from './balance_change';
require('mongoose-long')(mongoose);
export const Long = mongoose.Types.Long;
import logger from '../logger';

export const WithdrawalSchema = new mongoose.Schema({
  _id:             String,
  userId:          String,
  currId:          String,
  balanceChangeId: String,
  address:         String,
  txid:            String,
  fee:             mongoose.Schema.Types.Long,
  amount:          mongoose.Schema.Types.Long,
  changed:         mongoose.Schema.Types.Long,
  state:           { type: String, default: 'initial' },
  createdAt:       Date,
  updatedAt:       Date
});

WithdrawalSchema.statics = {
  balanceChanged: function(id) {
    Withdrawal.findOneAndUpdate({
      _id:   id,
      state: 'pending'
    }, {
      $set: { state: 'applied' }
    }, (e, wd) => {
      if (e) return logger.error("withdrawal.balanceChanged.find", e);
      wd.sendFunds();
    });
  }
};

WithdrawalSchema.methods = {
  verify: function(callback) {
    if (this.amount.lessThanOrEqual(Long.fromNumber(0))) return callback(new Error('negative'));
    Balance.findOne({
      userId: this.userId,
      currId: this.currId,
      amount: { $gte: this.amount }
    }, (err, balance) => {
      if (err) logger.error("Withdrawal.verify", err);
      callback(err, balance);
    });
  },

  verifyBalanceChange: function(callback) {
    BalanceChange.findOne({_id: this.balanceChangeId}, (err, bc) => {
      bc.state === 'done' ? callback(null, bc) : callback(new Error('BalanceChange not done'), bc);
    });
  },

  doBalanceChange: function() {
    Currency.balanceFor(this.currId, this.userId, (err, balance) => {
      if (balance.amount >= this.amount) balance.change(this);
    });
  },

  sendFunds: function() {
    this.verifyBalanceChange((err) => {
      if (err) return logger.error("sendFunds: verifyBalanceChange", err);
      let job = new Job('jobQueue', 'sendFunds', {currId: this.currId, wdId: this._id});
      job.save();
    });
  }
};

export const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

import Random from 'meteor-random'
import mongoose from 'mongoose'
import Job from 'meteor-job'
import {Currency} from './currency'
import {Balance} from './balance'
import {Notification} from './notification'
import {BalanceChange} from './balance_change'
require('mongoose-long')(mongoose);
export var Long = mongoose.Types.Long;

export var WithdrawalSchema = new mongoose.Schema({
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
    Withdrawal.findOne({_id: id}, (err, withdrawal) => {
      if (err) throw err;
      Withdrawal.findOneAndUpdate({
        _id: id,
        state: 'pending'
      }, {
        $set: { state: 'applied' }
      }, (err, wd) => {
        if (err) throw err;
        wd.sendFunds();
      });
    })
  }

}

WithdrawalSchema.methods = {
  verify: function(callback) {
    Balance.findOne({
      userId: this.userId,
      currId: this.currId,
      amount: { $gte: this.amount }
    }, (err, balance) => {
      if (err) throw err;
      callback(err, balance);
    })
  },

  verifyBalanceChange: function(callback) {
    BalanceChange.findOne({_id: this.balanceChangeId}, (err, bc) => {
      bc.state === 'done' ? callback(null, bc) : callback(new Error('BalanceChange not done'), bc);
    })
  },

  doBalanceChange: function() {
    Currency.balanceFor(this.currId, this.userId, (err, balance) => {
      balance.change(this)
    })
  },

  sendFunds: function () {
    this.verifyBalanceChange((err, bc) => {
      if (err) throw err;
      let job = new Job('jobQueue', 'sendFunds', {currId: this.currId, wdId: this._id});
      job.save();
    })
  }
}

export var Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

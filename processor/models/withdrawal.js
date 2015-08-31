import Random from 'meteor-random'
import mongoose from 'mongoose'
import {Currency} from './currency'
import {Balance} from './balance'
import {Notification} from './notification'
require('mongoose-long')(mongoose);
export var Long = mongoose.Types.Long;

export var WithdrawalSchema = new mongoose.Schema({
  _id:             String,
  userId:          String,
  currId:          String,
  balanceChangeId: String,
  address:         String,
  txid:            String,
  amount:          mongoose.Schema.Types.Long,
  status:          { type: String, default: 'initial' },
  createdAt:       Date,
  updatedAt:       Date
});

WithdrawalSchema.statics = {
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
  }
}

export var Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

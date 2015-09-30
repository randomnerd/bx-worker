import Random from 'meteor-random'
import mongoose from 'mongoose'
import findOrCreate from 'mongoose-findorcreate'
import {Currency} from './currency'
import {BalanceChange} from './balance_change'
import {Transaction} from './transaction'
require('mongoose-long')(mongoose);
export var Long = mongoose.Types.Long;

export var BalanceSchema = new mongoose.Schema({
  _id:    String,
  userId: String,
  currId: String,
  amount: mongoose.Schema.Types.Long,
  held:   mongoose.Schema.Types.Long,
  pendingChanges: [String]
});

BalanceSchema.plugin(findOrCreate);

BalanceSchema.methods = {
  change: function(subject) {
    // TODO: better behavior on this case
    if (subject.amount.isNegative() && subject.amount.negate().greaterThan(this.amount)) return false;

    switch (subject.constructor.modelName) {
      case 'Transaction':
        return this.changeWithTx(subject)
      case 'Withdrawal':
        return this.changeWithWithdrawal(subject)
      default:
        return this.changeWithParams(subject)
    }
  },

  changeWithTx: function(tx) {
    let change = new BalanceChange({
      _id: Random.id(),
      balanceId: this._id,
      currId: this.currId,
      subjId: tx._id,
      subjType: 'Transaction',
      amount: tx.amount,
      createdAt: new Date,
      state: 'initial'
    });
    change.save((err) => {
      if (err) throw err;
      tx.balanceChangeId = change._id;
      tx.save((err) => { if (err) throw err; });
    });
  },

  getCurrency: function(callback) {
    Currency.findOne({_id: this.currId}, callback);
  },

  changeWithWithdrawal: function(wd) {
    let fee = Long.fromNumber(wd.fee);
    let amount = Long.fromNumber(wd.amount);
    let changeAmount = amount.add(fee).negate();
    let change = new BalanceChange({
      _id: Random.id(),
      balanceId: this._id,
      currId: this.currId,
      subjId: wd._id,
      subjType: 'Withdrawal',
      amount: changeAmount,
      createdAt: new Date,
      state: 'initial'
    });
    change.save((err) => {
      if (err) throw err;
      wd.balanceChangeId = change._id;
      wd.save((err) => { if (err) throw err; });
    });
  },

  changeWithParams: function(params) {
    // stub
  }
}

export var Balance = mongoose.model('Balance', BalanceSchema);

import Random from 'meteor-random'
import mongoose from 'mongoose'
require('mongoose-long')(mongoose);
import findOrCreate from 'mongoose-findorcreate'
import {BalanceChange} from './balance_change'
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
    switch (subject.constructor.modelName) {
      case 'Transaction':
        return this.changeWithTx(subject)
      default:
        return this.changeWithParams(subject)
    }
  },

  changeWithTx: function(tx) {
    let change = new BalanceChange({
      _id: Random.id(),
      dstId: this._id,
      subjId: tx._id,
      subjType: tx.constructor.modelName,
      amount: tx.amount,
      createdAt: new Date,
      state: 'initial'
    });
    change.save((err) => {
      if (err) throw err;
    });
  },

  changeWithParams: function(params) {
    // stub
  }
}

export var Balance = mongoose.model('Balance', BalanceSchema);

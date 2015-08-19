import Random from 'meteor-random'
import mongoose from 'mongoose'
import findOrCreate from 'mongoose-findorcreate'
import {BalanceChange} from './balance_change'
export var BalanceSchema = new mongoose.Schema({
  _id:    String,
  userId: String,
  currId: String,
  amount: Number,
  held:   Number,
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
      this.pendingChanges.push(change._id);
      this.save((err) => {
        if (err) throw err;
        // trigger balance worker here to catch the change
      });
    });
  },

  changeWithParams: function(params) {
    // stub
  }
}

export var Balance = mongoose.model('Balance', BalanceSchema);

import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
import {Balance} from './balance';
import {Transaction} from './transaction';
import {Withdrawal} from './withdrawal';

export const BalanceChangeSchema = new mongoose.Schema({
  _id:       String,
  currId:    String,
  balanceId: String,
  subjId:    String,
  subjType:  String,
  amount:    mongoose.Schema.Types.Long,
  changed:   mongoose.Schema.Types.Long,
  held:      mongoose.Schema.Types.Long,
  createdAt: Date,
  updatedAt: Date,
  state:     String // initial, pending, applied, done, canceling, canceled
}, {
  collection: 'balance_changes'
});

BalanceChangeSchema.methods = {
  getBalance: function(callback) {
    Balance.findOne({_id: this.balanceId}, callback);
  },

  getSubjectClass: function() {
    switch (this.subjType) {
    case 'Transaction':
      return Transaction;
    case 'Withdrawal':
      return Withdrawal;
    default:
      return null;
    }
  },

  getSubject: function(callback) {
    this.getSubjectClass().findOne({_id: this.subjId}, callback);
  },

  setChangedAmount: function(callback) {
    this.getBalance((err, balance) => {
      this.changed = balance.amount + balance.held;
      this.updatedAt = new Date;
      this.save(callback);
      this.getSubject((e, subject) => {
        subject.changed = balance.amount + balance.held;
        subject.updatedAt = new Date;
        subject.save();
      });
    });
  }
};
export const BalanceChange = mongoose.model('BalanceChange', BalanceChangeSchema);

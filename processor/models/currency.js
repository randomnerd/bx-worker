import mongoose from 'mongoose'
import {Balance} from './balance'
export var CurrencySchema = new mongoose.Schema({
  _id:        String,
  published:  Boolean,
  shortName:  String,
  name:       String,
  status:     String
});

CurrencySchema.methods = {
  balanceFor: (userId, callback) => {
    Balance.findOrCreate({currId: this._id, userId: userId}, {amount: 0, held: 0}, callback)
  }
}

CurrencySchema.statics = {
  balanceFor: (currId, userId, callback) => {
    Balance.findOrCreate({currId: currId, userId: userId}, {amount: 0, held: 0}, callback)
  }
}

export var Currency = mongoose.model('Currency', CurrencySchema);

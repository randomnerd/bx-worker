import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
export const Long = mongoose.Types.Long;
import {Balance} from './balance';
export const CurrencySchema = new mongoose.Schema({
  _id:           String,
  published:     Boolean,
  shortName:     String,
  name:          String,
  status:        String,
  withdrawalFee: String
});

let longZero = Long.fromNumber(0);

CurrencySchema.methods = {
  balanceFor: (userId, callback) => {
    Balance.findOrCreate({currId: this._id, userId: userId}, {_id: Random.id(), amount: longZero, held: longZero}, callback);
  }
};

CurrencySchema.statics = {
  balanceFor: (currId, userId, callback) => {
    Balance.findOrCreate({currId: currId, userId: userId}, {_id: Random.id(), amount: longZero, held: longZero}, callback);
  }
};

export const Currency = mongoose.model('Currency', CurrencySchema);

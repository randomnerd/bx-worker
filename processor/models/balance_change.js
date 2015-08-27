import mongoose from 'mongoose'
require('mongoose-long')(mongoose);
export var BalanceChangeSchema = new mongoose.Schema({
  _id:       String,
  srcId:     String,
  dstId:     String,
  subjId:    String,
  subjType:  String,
  amount:    mongoose.Schema.Types.Long,
  createdAt: Date,
  updatedAt: Date,
  state:     String // initial, pending, applied, done, canceling, canceled
}, {
  collection: 'balance_changes'
});
export var BalanceChange = mongoose.model('BalanceChange', BalanceChangeSchema);

import mongoose from 'mongoose'
export var BalanceChangeSchema = new mongoose.Schema({
  _id:       String,
  srcId:     String,
  dstId:     String,
  subjId:    String,
  subjType:  String,
  amount:    Number,
  createdAt: Date,
  updatedAt: Date,
  state:     String // initial, pending, applied, done, canceling, canceled
}, {
  collection: 'balance_changes'
});
export var BalanceChange = mongoose.model('BalanceChange', BalanceChangeSchema);

import mongoose from 'mongoose'
export var TransactionSchema = new mongoose.Schema({
  _id:             String,
  userId:          String,
  currId:          String,
  walletId:        String,
  balanceChangeId: String,
  address:         String,
  txid:            String,
  category:        String,
  confirmations:   Number,
  amount:          Number,
  createdAt:       Date,
  updatedAt:       Date
});
export var Transaction = mongoose.model('Transaction', TransactionSchema);

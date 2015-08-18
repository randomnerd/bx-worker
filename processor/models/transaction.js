import mongoose from 'mongoose'
let Schema = mongoose.schema;

export var Transaction = new Schema({
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
})

import mongoose from 'mongoose'
export var WalletSchema = new mongoose.Schema({
  _id:        String,
  currId:     String,
  userId:     String,
  address:    String,
  createdAt:  Date
});
export var Wallet = mongoose.model('Wallet', WalletSchema);

import mongoose from 'mongoose'
export var BalanceSchema = new mongoose.Schema({
  _id:    String,
  userId: String,
  currId: String,
  amount: Number,
  held:   Number,
  pendingChanges: [String]
});
export var Balance = mongoose.model('Balance', BalanceSchema);

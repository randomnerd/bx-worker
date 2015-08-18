import mongoose from 'mongoose'
let Schema = mongoose.schema;

export var Balance = new Schema({
  _id:    String,
  userId: String,
  currId: String,
  amount: Number,
  held:   Number,
  pendingChanges: [String]
})

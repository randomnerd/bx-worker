import mongoose from 'mongoose'
let Schema = mongoose.schema;

export var Wallet = new Schema({
  _id:        String,
  currId:     String,
  userId:     String,
  address:    String,
  createdAt:  Date
})

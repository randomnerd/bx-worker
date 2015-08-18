import mongoose from 'mongoose'
let Schema = mongoose.schema;

export var Transaction = new Schema({
  _id:       String,
  srcId:     String,
  dstId:     String,
  subjId:    String,
  subjType:  String,
  amount:    Number,
  createdAt: Date,
  updatedAt: Date,
  state:     String // initial, pending, applied, done, canceling, canceled
})

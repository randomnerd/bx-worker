import mongoose from 'mongoose'
let Schema = mongoose.schema;

export var Notification = new Schema({
  _id:     String,
  userId:  String,
  title:   String,
  message: String,
  type:    String
})

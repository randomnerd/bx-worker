import mongoose from 'mongoose'
let Schema = mongoose.schema;

export var Currency = new Schema({
  _id:        String,
  published:  Boolean,
  shortName:  String,
  name:       String,
  status:     String
})

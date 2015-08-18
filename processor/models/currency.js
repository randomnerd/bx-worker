import mongoose from 'mongoose'
export var CurrencySchema = new mongoose.Schema({
  _id:        String,
  published:  Boolean,
  shortName:  String,
  name:       String,
  status:     String
});
export var Currency = mongoose.model('Currency', CurrencySchema);

import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;
export const TradePairSchema = new mongoose.Schema({
  _id:          String,
  currId:       String,
  marketCurrId: String,
  buyFee:       Number,
  sellFee:      Number,
  dayVolume:    mongoose.Schema.Types.Long,
  lastPrice:    Number,
  lastTrade:    Date
});

TradePairSchema.statics = {};
TradePairSchema.methods = {};

export const TradePair = mongoose.model('TradePair', TradePairSchema);

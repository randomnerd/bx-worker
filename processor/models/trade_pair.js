import mongoose from 'mongoose';
export const TradePairSchema = new mongoose.Schema({
  _id:          String,
  currId:       String,
  marketCurrId: String,
  buyFee:       Number,
  sellFee:      Number
});

TradePairSchema.statics = {};
TradePairSchema.methods = {};

export const TradePair = mongoose.model('TradePair', TradePairSchema);

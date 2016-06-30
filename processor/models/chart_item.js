import mongoose from 'mongoose';
import findOrCreate from 'mongoose-findorcreate';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;
export const ChartItemSchema = new mongoose.Schema({
  _id:    String,
  time:   Date,
  open:   mongoose.Schema.Types.Long,
  high:   mongoose.Schema.Types.Long,
  low:    mongoose.Schema.Types.Long,
  close:  mongoose.Schema.Types.Long,
  volume: mongoose.Schema.Types.Long,
  pairId: String
});

ChartItemSchema.statics = {
  groupInterval: function() {
    return 1 * 60 * 1000; // 1 minute
  }
};
ChartItemSchema.methods = {};

ChartItemSchema.plugin(findOrCreate);
export const ChartItem = mongoose.model('ChartItem', ChartItemSchema);

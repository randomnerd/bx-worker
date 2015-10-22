import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;
import async from 'async';
import Big from 'big.js';
import {TradePair} from './trade_pair';
import {Balance} from './balance';
import {Order} from './order';

export const OrderBookItemSchema = new mongoose.Schema({
  _id:          String,
  pairId:       String,
  amount:       mongoose.Types.Long,
  marketAmount: mongoose.Types.Long,
  price:        mongoose.Types.Long,
  buy:          Boolean
});

OrderBookItemSchema.statics = {};
OrderBookItemSchema.methods = {};

export const OrderBookItem = mongoose.model('OrderBookItem', OrderBookItemSchema);

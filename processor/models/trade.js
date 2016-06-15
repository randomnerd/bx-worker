import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;
import async from 'async';
import Big from 'big.js';
import {TradePair} from './trade_pair';
import {Balance} from './balance';
import {Order} from './order';
import {Currency} from './currency';
import logger from '../logger';

export const TradeSchema = new mongoose.Schema({
  _id:        String,
  pairId:     String,
  buyerId:    String,
  sellerId:   String,
  buyId:      String,
  sellId:     String,
  amount:     mongoose.Types.Long,
  price:      mongoose.Types.Long,
  buyFee:     mongoose.Types.Long,
  sellFee:    mongoose.Types.Long,
  state:      String,
  createdAt:  Date
});

TradeSchema.statics = {};
TradeSchema.methods = {
  process: function(callback) {
    async.series([
      (cb) => { this.moveFunds(cb); },
      (cb) => { this.updateOrders(cb); },
      (cb) => { this.updateStats(cb); },
      (cb) => { this.notifyUsers(cb); },
      (cb) => { this.updateChart(cb) }
    ], callback);
  },

  moveFunds: function(callback) {
    TradePair.findOne({_id: this.pairId}, (err, pair) => {

      let series = [];
      series.push((cb) => {
        Currency.balanceFor(pair.currId, this.buyerId, (e, balance) => {
          balance.change(this, cb);
        });
      });
      series.push((cb) => {
        Currency.balanceFor(pair.marketCurrId, this.buyerId, (e, balance) => {
          balance.change(this, cb);
        });
      });

      if (this.buyerId !== this.sellerId) {
        series.push((cb) => {
          Currency.balanceFor(pair.currId, this.sellerId, (e, balance) => {
            balance.change(this, cb);
          });
        });
        series.push((cb) => {
          Currency.balanceFor(pair.marketCurrId, this.sellerId, (e, balance) => {
            balance.change(this, cb);
          });
        });
      }

      async.series(series, (err, ret) => { callback(err); });
    });
  },

  marketAmount: function() {
    return this.amount.multiply(this.price).div(new Long(Math.pow(10,8)));
  },

  updateOrders: function(callback) {
    async.series([
      (cb) => {
        // update sell order
        Order.findOneAndUpdate({
          _id: this.sellId
        }, {
          $inc: { remain: this.amount.negate() }
        }, {
          new: true
        }, (err, order) => {
          if (!order.remain.equals(Long.fromNumber(0))) return cb(null);
          Order.update({_id: order._id}, {$set: {complete: true}, $push: {trades: this._id}}, cb);
        });
      },
      (cb) => {
        // update buy order
        Order.findOneAndUpdate({
          _id: this.buyId
        }, {
          $inc: { remain: this.amount.negate() }
        }, {
          new: true
        }, (err, order) => {
          if (!order.remain.equals(Long.fromNumber(0))) return cb(null);
          Order.update({_id: order._id}, {$set: {complete: true}, $push: {trades: this._id}}, cb);
        });
      }
    ], callback);
  },

  updateStats: function(callback) {
    TradePair.update({_id: this.pairId}, {
      $set: {
        lastPrice: this.price,
        lastTrade: this.createdAt
      },
      $inc: {
        dayVolume: this.amount
      }
    }, callback);
    // callback(null);
  },

  updateChart: function(callback) {
    // STUB
    callback(null);
  },

  notifyUsers: function(callback) {
    // STUB
    callback(null);
  }
};

export const Trade = mongoose.model('Trade', TradeSchema);

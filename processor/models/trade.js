import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;
import async from 'async';
import Big from 'big.js';
import {TradePair} from './trade_pair';
import {Balance} from './balance';
import {Order} from './order';
import {Currency} from './currency';

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
      async.series([
        // move buyer funds
        (cb) => {
          Currency.balanceFor(pair.currId, this.buyerId, (e, balance) => {
          // Balance.findOne({userId: this.buyerId, currId: pair.currId}, (e, balance) => {
            balance.change(this, cb);
          });
        },
        (cb) => {
          Currency.balanceFor(pair.marketCurrId, this.buyerId, (e, balance) => {
          // Balance.findOne({userId: this.buyerId, currId: pair.marketCurrId}, (e, balance) => {
            balance.change(this, cb);
          })
        },
        // move seller funds
        (cb) => {
          Currency.balanceFor(pair.currId, this.sellerId, (e, balance) => {
          // Balance.findOne({userId: this.sellerId, currId: pair.currId}, (e, balance) => {
            balance.change(this, cb);
          });
        },
        (cb) => {
          Currency.balanceFor(pair.marketCurrId, this.sellerId, (e, balance) => {
          // Balance.findOne({userId: this.sellerId, currId: pair.marketCurrId}, (e, balance) => {
            balance.change(this, cb);
          });
        }
      ], (err) => { callback(err); });
    });
  },

  marketAmount: function() {
    // FIXME: crazy shit here
    let bigAmount = Big((this.amount.toNumber()/Math.pow(10,8)).toString());
    let bigPrice  = Big((this.price.toNumber()/Math.pow(10,8)).toString());
    let bigMarketAmount = bigAmount.mul(bigPrice).mul(Big(Math.pow(10, 8)));
    return Long.fromString(bigMarketAmount.toString());
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
          Order.update({_id: order._id}, {$set: {complete: true}}, cb);
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
          Order.update({_id: order._id}, {$set: {complete: true}}, cb);
        });
      }
    ], callback);
  },

  updateStats: function(callback) {
    // STUB
    callback(null);
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

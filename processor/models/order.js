import Random from 'meteor-random';
import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;

import async from 'async';
import {Trade} from './trade';
import Big from 'big.js';

export const OrderSchema = new mongoose.Schema({
  _id:        String,
  pairId:     String,
  userId:     String,
  amount:     mongoose.Schema.Types.Long,
  price:      mongoose.Schema.Types.Long,
  remain:     mongoose.Schema.Types.Long,
  complete:   Boolean,
  canceled:   Boolean,
  buy:        Boolean,
  fee:        Number,
  createdAt:  Date,
  updatedAt:  Date,
  completeAt: Date,
  trades:     [String]
});

OrderSchema.statics = {};
OrderSchema.methods = {
  process: function() {
    this.findMatches((err, matches) => {
      if (err) { console.log(err) };
      if (!matches.length) { console.log('no matches found'); return; };

      async.mapSeries(matches, (item, callback) => {
        this.processMatch(item, callback);
      }, (err) => {

      })
    })
  },

  marketAmount: function() {
    // FIXME: crazy shit here
    let bigAmount = Big((this.amount.toNumber()/Math.pow(10,8)).toString());
    let bigPrice  = Big((this.price.toNumber()/Math.pow(10,8)).toString());
    let bigMarketAmount = bigAmount.mul(bigPrice).mul(Big(Math.pow(10, 8)));
    return Long.fromString(bigMarketAmount.toString());
  },

  marketRemain: function() {
    // FIXME: crazy shit here
    let bigRemain = Big((this.remain.toNumber()/Math.pow(10,8)).toString());
    let bigPrice  = Big((this.price.toNumber()/Math.pow(10,8)).toString());
    let bigMarketRemian = bigRemain.mul(bigPrice).mul(Big(Math.pow(10, 8)));
    return Long.fromString(bigMarketRemian.toString());
  },

  processMatch(order, callback) {
    console.log('processing match', order);
    let tradeAmount = this.remain.greaterThan(order.remain) ? order.remain : this.remain;
    let minPrice = this.price.lessThan(order.price) ? this.price : order.price;
    let maxPrice = this.price.lessThan(order.price) ? order.price : this.price;
    let tradePrice = this.buy ? minPrice : maxPrice;
    // TODO: calc fees
    let tradeBuyFee = this.buy ? this.fee : order.fee;
    let tradeSellFee = this.buy ? order.fee : this.fee;

    let trade = new Trade({
      _id:       Random.id(),
      price:     tradePrice,
      amount:    tradeAmount,
      pairId:    this.pairId,
      buyId:     this.buy ? this._id : order._id,
      sellId:    this.buy ? order._id : this._id,
      buyerId:   this.buy ? this.userId : order.userId,
      sellerId:  this.buy ? order.userId : this.userId,
      state:     'initial',
      buyFee:    0,
      sellFee:   0,
      createdAt: new Date
    });
    trade.save((err) => {
      trade.process(callback);
    });
  },

  findMatches: function(callback) {
    let params = {
      buy:      !this.buy,
      price:    this.buy ? { $lte: this.price } : { $gte: this.price },
      pairId:   this.pairId,
      complete: false,
      canceled: false
    };
    let options = {
      sort: {
        // if we're buying, find cheapest matches first (ASC sort on price)
        // otherwise find most expensive matches first
        price: this.buy ? 1 : -1,
        // on the same price, process older orders first (DESC sort on created time)
        createdAt: -1
      }
    };

    console.log('looking for matches', params);
    Order.find(params, options, callback);
  }
};

export const Order = mongoose.model('Order', OrderSchema);

import Random from 'meteor-random';
import mongoose from 'mongoose';
import _ from 'lodash';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;

import async from 'async';
import {Trade} from './trade';
import Big from 'big.js';
import logger from '../logger';

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
  process: function(callback) {
    if (!this.price) return callback(new Error('zero-priced order!'));
    this.findMatches((err, matches) => {
      if (err) return logger.error(err);
      if (!matches.length) {
        logger.info('no matches found');
        return callback();
      }

      async.mapSeries(matches, (item, cb) => {
        Order.findOne({
          _id: this._id,
          canceled: false,
          complete: false,
          remain: {$gt: Long.fromNumber(0)}
        }, (error, order) => {
          if (error || !order) return cb(error || 'didnt match');
          _.assign(this, order);
          this.processMatch(item, cb);
        });
      }, (err) => {
        logger.info('all matches processed');
        callback(err);
      })
    })
  },

  marketAmount: function() {
    return this.amount.multiply(this.price).div(new Long(Math.pow(10,8)));
  },

  marketRemain: function() {
    return this.remain.multiply(this.price).div(new Long(Math.pow(10,8)));
  },

  processMatch(order, callback) {
    if (!this.price || !order.price) return callback(new Error('zero-priced order!'));
    logger.info('processing match', order._doc);
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

    Order.find(params, null, options, callback);
  }
};

export const Order = mongoose.model('Order', OrderSchema);

import Random from 'meteor-random';
import mongoose from 'mongoose';
import findOrCreate from 'mongoose-findorcreate';
import {Currency} from './currency';
import {BalanceChange} from './balance_change';
import {TradePair} from './trade_pair';

require('mongoose-long')(mongoose);
export const Long = mongoose.Types.Long;

export const BalanceSchema = new mongoose.Schema({
  _id:            String,
  userId:         String,
  currId:         String,
  amount:         mongoose.Schema.Types.Long,
  held:           mongoose.Schema.Types.Long,
  pendingChanges: [String]
});

BalanceSchema.statics = {
  verifyAmount: function(params, callback) {
    let {userId, currId, amount} = params;
    console.log('verify amount', params);
    Balance.findOne({userId: userId, currId: currId, amount: {$gte: amount}}, callback);
  }
};

BalanceSchema.methods = {
  change: function(subject, callback) {
    // TODO: better behavior on this case
    if (subject.amount.isNegative() && subject.amount.negate().greaterThan(this.amount)) return false;

    switch (subject.constructor.modelName) {
    case 'Transaction':
      return this.changeWithTx(subject, callback);
    case 'Withdrawal':
      return this.changeWithWithdrawal(subject, callback);
    case 'Trade':
      return this.changeWithTrade(subject, callback);
    default:
      return this.changeWithParams(subject, callback);
    }
  },

  changeWithTx: function(tx, callback) {
    let change = new BalanceChange({
      _id:       Random.id(),
      balanceId: this._id,
      currId:    this.currId,
      subjId:    tx._id,
      subjType:  'Transaction',
      amount:    tx.amount,
      createdAt: new Date,
      state:     'initial'
    });
    change.save((err) => {
      if (err) throw err;
      tx.balanceChangeId = change._id;
      tx.save((e) => {
        if (e) throw e;
        if (callback) callback(null);
      });
    });
  },

  getCurrency: function(callback) {
    Currency.findOne({_id: this.currId}, callback);
  },

  changeWithWithdrawal: function(wd, callback) {
    let fee = Long.fromNumber(wd.fee);
    let amount = Long.fromNumber(wd.amount);
    let changeAmount = amount.add(fee).negate();
    let change = new BalanceChange({
      _id:       Random.id(),
      balanceId: this._id,
      currId:    this.currId,
      subjId:    wd._id,
      subjType:  'Withdrawal',
      amount:    changeAmount,
      createdAt: new Date,
      state:     'initial'
    });
    change.save((err) => {
      if (err) throw err;
      wd.balanceChangeId = change._id;
      wd.save((e) => {
        if (e) throw e;
        if (callback) callback(null);
      });
    });
  },

  changeWithTrade(trade, callback) {
    let longZero = Long.fromNumber(0);
    let amount   = longZero;
    let held     = longZero;

    TradePair.findOne({_id: trade.pairId}, (err, pair) => {
      let buy    = this.userId === trade.buyerId;
      let sell   = this.userId === trade.sellerId;
      let market = this.currId === pair.marketCurrId;


      if (market) {
        if (buy)  held = held.add(trade.marketAmount().negate());
        if (sell) amount = amount.add(trade.marketAmount());
      } else {
        if (buy)  amount = amount.add(trade.amount);
        if (sell) held = held.add(trade.amount.negate());
      }

      let str1 = buy ? 'buy' : 'sell';
      let str2 = market ? 'market' : 'currency';
      console.log(`${str1} ${str2}`, amount, held);

      Balance.findOneAndUpdate({
        _id: this._id
      }, {
        $inc: {
          amount: amount,
          held: held
        }
      }, callback);

      if (amount.notEquals(longZero)) {
        let change = new BalanceChange({
          _id: Random.id(),
          balanceId: this._id,
          currId: this.currId,
          subjId: trade._id,
          subjType: 'Trade',
          amount: amount,
          createdAt: new Date(),
          state: 'done'
        });
      }
    });

  },

  changeWithParams: function(params) {
    return params; //stub
  }
};

BalanceSchema.plugin(findOrCreate);
export let Balance = mongoose.model('Balance', BalanceSchema);

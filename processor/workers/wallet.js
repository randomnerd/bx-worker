import Random from 'meteor-random';
import bitcoin from 'bitcoin';
import {BaseWorker} from './base';
import _ from 'underscore';
import {Wallet} from '../models/wallet';
import {Transaction} from '../models/transaction';
import {Withdrawal} from '../models/withdrawal';
import {Order} from '../models/order';
import {TradePair} from '../models/trade_pair';
import {Balance} from '../models/balance';
import {BalanceChange} from '../models/balance_change';

import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;

export class WalletWorker extends BaseWorker {
  init() {
    this.name = 'WalletWorker';
    this.configName = 'wallet';
    this.clients = {};
  }

  startClient(id, config) {
    this.logger.info('Starting', config.name, 'client');
    let client = this.clients[id] = new bitcoin.Client(config.rpc);
    client.currId = id;
    client.currName = config.name;
    client.confReq = config.confReq;
    client.getBalance((err, balance) => {
      this.logger.info(config.name, 'balance:', balance);
    });
  }

  startClients() {
    let currs = this.config.currencies;
    for (let id of Object.keys(currs)) {
      this.startClient(id, currs[id]);
    }
  }

  startTimer() {
    this.timer = setInterval(this.processAllCurrencies.bind(this), this.config.updateInterval);
  }

  stopTimer() {
    this.timer && clearInterval(this.timer);
  }

  start() {
    this.startClients();
    this.startTimer();
    super.start();
  }

  stop() {
    this.stopTimer();
    super.stop();
  }

  getJobMap() {
    return {
      newAddress: this.newAddress,
      processDeposits: this.processDeposits,
      sendFunds: this.sendFunds,
      newOrder: this.newOrder,
      cancelOrder: this.cancelOrder
    };
  }

  newOrder(job, callback) {
    this.logger.info('Creating order');
    try {
      this._newOrder(job.data);
      job.done();
    } catch (e) {
      this.logger.error('Processing job', job, 'failed:', e.toString());
      job.fail(e.toString());
    } finally { callback(); }
  }

  cancelOrder(job, callback) {
    this.logger.info('Canceling order');
    try {
      this._cancelOrder(job.data.id);
      job.done();
    } catch (e) {
      this.logger.error('Processing job', job, 'failed:', e.toString());
      job.fail(e.toString());
    } finally { callback(); }
  }

  _cancelOrder(id) {
    Order.findOneAndUpdate({_id: id, canceled: false}, {$set: {canceled: true}}, {new: true}, (err, order) => {
      if (!order) return;
      TradePair.findOne({_id: order.pairId}, (pairErr, pair) => {
        let currId = order.buy ? pair.marketCurrId : pair.currId;
        let amount = order.buy ? order.marketRemain() : order.remain;
        Balance.findOneAndUpdate({
          userId: order.userId,
          currId: currId
        }, {
          $inc: {
            held: amount.negate(),
            amount: amount
          }
        }, {new: true}, (orderErr, balance) => {
          let change = new BalanceChange({
            _id:       Random.id(),
            balanceId: balance._id,
            currId:    currId,
            subjId:    order._id,
            subjType:  'Order',
            amount:    amount,
            createdAt: new Date(),
            state:     'done'
          });
          change.save((changeSaveErr) => {
            if (changeSaveErr) {
              this.logger.error('Unable to save balancechange');
              throw new Error('Unable to save balancechange');
            };
          });
        })
      })
    });
  }

  _newOrder(params) {
    TradePair.findOne({_id: params.pairId}, (err, pair) => {
      if (err || !pair) { this.logger.error('Pair not found'); return false; }
      let currId = params.buy ? pair.marketCurrId : pair.currId;
      let curr = this.config.currencies[currId];
      let amount = parseFloat(params.amount) * Math.pow(10, 8);
      let price = parseFloat(params.price) * Math.pow(10, 8);
      let marketAmount = parseFloat(params.amount) * parseFloat(params.price) * Math.pow(10, 8);
      let longAmount = Long.fromNumber(params.buy ? marketAmount : amount);
      let change = {
        amount: longAmount.negate(),
        held: longAmount
      };
      Balance.verifyAmount({
        userId: params.userId,
        currId: currId,
        amount: params.buy ? marketAmount: amount,
      }, (error, balance) => {
        if (error || !balance) {
          this.logger.error('Unable to verify balance');
          throw new Error('Unable to verify balance');
        }
        Balance.findOneAndUpdate({_id: balance._id}, {$inc: change}, {new: true}, (e, newBalance) => {
          if (e || !newBalance) {
            this.logger.error('Unable to update balance');
            throw new Error('Unable to update balance');
          }
          let orderId = Random.id();
          let change = new BalanceChange({
            _id:       Random.id(),
            balanceId: newBalance._id,
            currId:    newBalance.currId,
            subjId:    orderId,
            subjType:  'Order',
            amount:    longAmount.negate(),
            createdAt: new Date(),
            state:     'done'
          });
          change.save((changeSaveErr) => {
            if (changeSaveErr) {
              this.logger.error('Unable to save balancechange');
              throw new Error('Unable to save balancechange');
            };
            console.log('saved balancechange');
            let order = new Order({
              _id:       orderId,
              pairId:    params.pairId,
              userId:    params.userId,
              buy:       params.buy,
              amount:    Long.fromNumber(amount),
              price:     Long.fromNumber(price),
              remain:    Long.fromNumber(amount),
              complete:  false,
              canceled:  false,
              fee:       0,
              createdAt: new Date()
            });
            console.log('created order');
            order.save((orderSaveErr) => {
              if (orderSaveErr) {
                this.logger.error('Unable to save order');
                throw new Error('Unable to save order');
              }
              console.log('saved order');
            });
          });
        });
      })
    })
  }

  newAddress(job, callback) {
    let {userId, currId} = job.data;
    let client = this.clients[currId];
    if (!client) {
      // TODO: check user & currency at database
      job.fail('No client configured for currency ' + currId);
      return callback();
    }
    client.getNewAddress((err, address) => {
      if (err) {
        job.fail(err.toString());
      } else {
        this.logger.info('New address for user', userId, '/ currency', currId, '/', address);

        let wallet = Wallet.newUserAddress(userId, currId, address, (e) => {
          if (e) {
            job.fail(err.toString());
          } else {
            this.logger.info('Address saved with id', wallet.id);
            job.done();
          }
        });
      }
      callback();
    });
  }

  updateDepositConfirmations(job, callback) {
    let curr = this.config.currencies[job.data.currId];
    let client = this.clients[job.data.currId];
    if (!curr || !client) {
      job.fail('Currency not configured');
      return callback();
    }

    this.logger.info('Updating deposit confirmations for', curr.name);
    try {
      this._updateDepositConfirmations(job.data.currId);
      job.done();
    } catch (e) {
      this.logger.error('Processing job', job, 'failed:', e.toString());
      job.fail(e.toString());
    } finally { callback(); }
  }

  _updateDepositConfirmations(currId) {
    let client = this.clients[currId];
    Transaction.find({
      currId: currId,
      confirmations: { $lt: client.confReq },
      balanceChangeId: null
    }, (err, txs) => {
      for (let tx of txs) {
        tx.updateConfirmations(client);
      }
    });
  }

  processAllCurrencies() {
    try {
      for (let currId of Object.keys(this.clients)) {
        this._processDeposits(currId);
        this._updateDepositConfirmations(currId);
      }
    } catch (e) {
      console.log('Error processing currencies:');
      console.log(e);
    }
  }

  processDeposits(job, callback) {
    let curr = this.config.currencies[job.data.currId];
    let client = this.clients[job.data.currId];
    if (!curr || !client) {
      job.fail('Currency not configured');
      return callback();
    }

    this.logger.info('Processing deposits for', curr.name);
    try {
      this._processDeposits(job.data.currId);
      job.done();
    } catch (e) {
      this.logger.error('Processing job', job, 'failed:', e.toString());
      job.fail(e.toString());
    } finally { callback(); }
  }

  _processDeposits(id, skip = 0, batch = 50) {
    let client = this.clients[id];

    client.listTransactions(null, batch, skip, (err, result) => {
      if (err) {console.log(err); throw new Error('Error listing transactions: ' + err); }
      if (!result.transactions || result.transactions.length === 0) return;

      let txids = _.uniq(_.pluck(result.transactions, 'txid'));
      // check if those ids are already in database
      Transaction.find({txid: {$in: txids}}, (e, foundTxs) => {
        // stop processing if transaction has been processed already
        // this usually means all transactions after this one have
        // been processed too
        // TODO: this needs to be tested against various conditions
        //       where this assumption could happen to be false

        // filter transactions:
        // - only process when category is receive
        // - skip if alreary in DB
        // - select distinct on txid
        let foundIds = _.pluck(foundTxs, 'txid');
        let newTxids = [];
        let txs = _.reduce(result.transactions, (memo, tx) => {
          if (tx.category !== 'receive') return memo;
          if (_.contains(foundIds, tx.txid)) return memo;
          if (_.contains(newTxids, tx.txid)) return memo;

          newTxids.push(tx.txid);
          memo.push(tx);
          return memo;
        }, []);

        for (let tx of txs) {
          this._processDepositTx(client, tx);
        }

        // if array size is less than batch then we are either
        // at the end of the list or some of those TXs have been
        // processed already, both situations should terminate the loop
        if (txs.length < batch) return;
        // otherwise go to the next batch
        this._processDeposits(id, skip + batch, batch);
      });
    });
  }

  _processDepositTx(client, tx) {
    client.getTransaction(tx.txid, (err, result) => {
      if (err) {
        console.log('Error listing transaction details: ', err);
        return setTimeout(() => {
          this._processDepositTx(client, tx);
        }, this.config.updateInterval);
      }
      for (let rawtx of result.details) {
        if (rawtx.category !== 'receive') continue;

        Wallet.findOne({address: rawtx.address}, (e, wallet) => {
          this._newDeposit(rawtx, wallet, client.confReq);
        });
      }
    });
  }

  _newDeposit(tx, wallet, confReq) {
    if (!wallet) { return false; }
    Transaction.newDeposit(tx, wallet, confReq);
  }

  sendFunds(job, callback) {
    let curr = this.config.currencies[job.data.currId];
    let client = this.clients[job.data.currId];
    if (!curr || !client) {
      job.fail('Currency not configured');
      return callback();
    }

    this.logger.info('Withdrawal', job.data.wdId);
    try {
      Withdrawal.findOne({_id: job.data.wdId, state: 'applied'}, (err, wd) => {
        this._processWithdrawal(curr, client, wd);
      });
      job.done();
    } catch (e) {
      this.logger.error('Processing job', job, 'failed:', e.toString());
      job.fail(e.toString());
    } finally { callback(); }
  }

  _processWithdrawal(curr, client, wd) {
    console.log('processWithdrawal');
    wd.verifyBalanceChange((err, bc) => {
      console.log('verifyBalanceChange');
      console.log(err, bc);
      if (err) throw err;
      let amount = wd.amount / Math.pow(10, 8);
      this.logger.info(`Withdrawal of ${amount} to ${wd.address}`);

      // TODO: actually send funds
      client.sendToAddress(wd.address, amount, (err, result) => {
        console.log(result);
        wd.txid = result;
        wd.state = 'done';
        wd.save();
      });
    });
  }

}

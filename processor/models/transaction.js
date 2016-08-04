import Random from 'meteor-random';
import mongoose from 'mongoose';
import {Currency} from './currency';
import {Long} from './balance';
import {Notification} from './notification';
import Big from 'big.js';
import logger from '../logger';

export const TransactionSchema = new mongoose.Schema({
  _id:             String,
  userId:          String,
  currId:          String,
  walletId:        String,
  balanceChangeId: String,
  address:         String,
  blockNumber:     Number,
  txid:            String,
  confirmations:   Number,
  amount:          mongoose.Schema.Types.Long,
  changed:         mongoose.Schema.Types.Long,
  createdAt:       Date,
  updatedAt:       Date,
  moved:           Boolean
});

TransactionSchema.statics = {
  newDeposit: function(tx, wallet, confReq) {
    // save deposit
    let amount = tx.amount || tx.value;
    if (amount.s) {
      amount = new Long(tx.value.div(Math.pow(10, 10)).toNumber());
    } else {
      amount = new Long(tx.amount * Math.pow(10, 8));
    }
    let newTx = new Transaction({
      _id:             Random.id(),
      userId:          wallet.userId,
      currId:          wallet.currId,
      walletId:        wallet._id,
      balanceChangeId: null,
      blockNumber:     tx.blockNumber || 0,
      txid:            tx.txid || tx.hash,
      address:         tx.address || tx.to,
      confirmations:   Math.abs(tx.confirmations || 1),
      amount:          amount,
      createdAt:       new Date,
      updatedAt:       null,
      moved:           false
    });

    newTx.save((err) => {
      if (err) {
        return logger.error("newDeposit.sace", err);
      }

      newTx.notifyUser();
      if (newTx.confirmations >= confReq) newTx.matureDeposit();
    });
  }
};

TransactionSchema.methods = {
  displayAmount: function() {
    return new Big(this.amount.toString()).div(Math.pow(10, 8)).toString();
  },
  notifyUser: function() {
    Currency.findOne({_id: this.currId}, (err, curr) => {
      if (err) return logger.error("notifyUser.findCurrency", err);
      Notification.notify(
        this.userId,
        `Incoming: ${this.displayAmount()} ${curr.shortName}`,
        `${this.displayAmount()} ${curr.shortName} received at ${this.address}`,
        'newTransaction'
      );
    });
  },

  updateConfirmations: function(client) {
    if (client._client.eth) {
      let numConf = client._client.eth.blockNumber - this.blockNumber + 1;
      if (numConf != this.confirmations) {
        this.confirmations = numConf;
        this.updatedAt = new Date;
        this.save();
      }
    } else {
      client.getTransaction(this.txid, (err, txdata) => {
        if (err) return logger.error("updateConfirmations.getTransaction", err);
        if (txdata.confirmations === this.confirmations || !txdata.confirmations) return;

        this.confirmations = txdata.confirmations;
        this.updatedAt = new Date;
        this.save();
      });
    }

    if (this.confirmations >= client.confReq) this.matureDeposit();
  },

  matureDeposit: function() {
    // update user balance, send notification
    Currency.balanceFor(this.currId, this.userId, (err, balance) => {
      balance.change(this);
    });
  }

};

export const Transaction = mongoose.model('Transaction', TransactionSchema);

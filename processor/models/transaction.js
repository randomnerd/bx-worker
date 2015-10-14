import Random from 'meteor-random';
import mongoose from 'mongoose';
import {Currency} from './currency';
import {Long} from './balance';
import {Notification} from './notification';
import Big from 'big.js';
export const TransactionSchema = new mongoose.Schema({
  _id:             String,
  userId:          String,
  currId:          String,
  walletId:        String,
  balanceChangeId: String,
  address:         String,
  txid:            String,
  confirmations:   Number,
  amount:          mongoose.Schema.Types.Long,
  changed:         mongoose.Schema.Types.Long,
  createdAt:       Date,
  updatedAt:       Date
});

TransactionSchema.statics = {
  newDeposit: function(tx, wallet, confReq) {
    // save deposit

    let newTx = new Transaction({
      _id:             Random.id(),
      userId:          wallet.userId,
      currId:          wallet.currId,
      walletId:        wallet._id,
      balanceChangeId: null,
      txid:            tx.txid,
      address:         tx.address,
      confirmations:   Math.abs(tx.confirmations),
      amount:          new Long(tx.amount * Math.pow(10, 8)),
      createdAt:       new Date,
      updatedAt:       null
    });
    newTx.save((err) => {
      if (err) throw err;
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
      if (err) throw err;
      Notification.notify(
        this.userId,
        `Incoming: ${this.displayAmount()} ${curr.shortName}`,
        `${this.displayAmount()} ${curr.shortName} received at ${this.address}`,
        'newTransaction'
      );
    });
  },

  updateConfirmations: function(client) {
    client.getTransaction(this.txid, (err, txdata) => {
      if (err) {console.log(err); throw new Error('Error listing transaction details: ' + err); }
      if (txdata.confirmations === this.confirmations) return;

      this.confirmations = txdata.confirmations;
      this.updatedAt = new Date;
      this.save();

      if (this.confirmations >= client.confReq) this.matureDeposit();
    });
  },

  matureDeposit: function() {
    // update user balance, send notification
    Currency.balanceFor(this.currId, this.userId, (err, balance) => {
      balance.change(this);
    });
  }

};

export const Transaction = mongoose.model('Transaction', TransactionSchema);

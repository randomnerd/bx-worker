import Random from 'meteor-random'
import mongoose from 'mongoose'
import {Currency} from './currency'
import {Balance} from './balance'
import {Notification} from './notification'
export var TransactionSchema = new mongoose.Schema({
  _id:             String,
  userId:          String,
  currId:          String,
  walletId:        String,
  balanceChangeId: String,
  address:         String,
  txid:            String,
  category:        String,
  confirmations:   Number,
  amount:          Number,
  createdAt:       Date,
  updatedAt:       Date
});

TransactionSchema.statics = {
  newDeposit: function(tx, wallet) {
    // save deposit
    // rawtx is the source of truth for tx amount and destination address
    // tx is the source of truth for other tx details

    let newTx = new Transaction({
      _id: Random.id(),
      userId: wallet.userId,
      currId: wallet.currId,
      walletId: wallet._id,
      balanceChangeId: null,
      txid: tx.txid,
      address: tx.address,
      category: tx.category,
      confirmations: Math.abs(tx.confirmations),
      amount: tx.amount,
      createdAt: new Date,
      updatedAt: null
    });
    newTx.save((err) => {
      if (err) throw err;
      newTx.notifyUser();
    });
  }
}

TransactionSchema.methods = {
  notifyUser: function() {
    Currency.findOne({_id: this.currId}, (err, curr) => {
      if (err) throw err;
      Notification.notify(
        this.userId,
        `Incoming: ${this.amount} ${curr.shortName}`,
        `${this.amount} ${curr.shortName} received at ${this.address}`,
        'newTransaction'
      );
    })
  },

  updateConfirmations: function(client) {
    client.getTransaction(this.txid, (err, txdata) => {
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
      balance.change(this)
    })
  }

}

export var Transaction = mongoose.model('Transaction', TransactionSchema);

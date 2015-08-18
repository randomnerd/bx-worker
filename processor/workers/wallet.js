import bitcoin from 'bitcoin'
import {BaseWorker} from './base'
import Random from 'meteor-random'
import Big from 'big.js'
import _ from 'underscore'

export class WalletWorker extends BaseWorker {
  init() {
    this.name = 'WalletWorker';
    this.configName = 'wallet';
    this.clients = {};
  }

  startClient(id, config) {
    this.logger.info('Starting', config.name, 'client')
    let client = this.clients[id] = new bitcoin.Client(config.rpc);
    client.currId = id;
    client.currName = config.name;
    client.confReq = config.confReq;
    client.getBalance((err, balance) => {
      this.logger.info(config.name, 'balance:', balance)
    })
  }

  startClients() {
    let currs = this.config.currencies;
    for (let id of Object.keys(currs)) {
      this.startClient(id, currs[id])
    }
  }

  start() {
    this.startClients();
    super.start();
  }

  getJobMap() {
    return {
      newAddress: this.newAddress,
      processDeposits: this.processDeposits
    }
  }

  newAddress(job, callback) {
    let {userId, currId} = job.data;
    let client = this.clients[currId];
    if (!client) {
      // TODO: check user & currency at database
      job.fail("No client configured for currency " + currId);
      return callback();
    }
    client.getNewAddress((err, address) => {
      if (err) {
        job.fail(err.toString())
      } else {
        this.logger.info('New address for user', userId, '/ currency', currId, '/', address);

        let wallet = this._saveWallet(userId, currId, address, (err) => {
          if (err) {
            job.fail(err.toString())
          } else {
            this.logger.info('Address saved with id', wallet.id);
            job.done()
          }
        });
      }
      callback()
    })
  }

  _saveWallet(userId, currId, address, cb) {
    let wallet = new this.models.Wallet({
      _id: Random.id(),
      currId: currId,
      userId: userId,
      address: address,
      createdAt: new Date
    });
    wallet.save(cb.bind(this));
    return wallet;
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
    this.models.Transaction.find({
      currId: currId,
      confirmations: { $lt: client.confReq },
      balanceChangeId: null
    }, (err, txs) => {
      for (let tx of txs) {
        this._updateTxConf(tx);
      }
    });
  }

  _updateTxConf(tx) {
    let client = this.clients[tx.currId];
    client.getTransaction(tx.txid, (err, txdata) => {
      return if txdata.confirmations === tx.confirmations;

      tx.confirmations = txdata.confirmations;
      tx.updatedAt = new Date;
      tx.save();

      if (tx.confirmations >= client.confReq) this._matureDeposit(tx);
    });
  }

  _matureDeposit(tx) {
    // update user balance, send notification
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
      if (err) throw 'Error listing transactions: ' + err;
      if (!result.transactions || result.transactions.length === 0) return;

      let txids = _.pluck(result.transactions, 'txid');

      this.models.Transaction.find({txid: {$in: txids}}, (err, txs) => {
        // stop processing if transaction has been processed already
        // this usually means all transactions after this one have
        // been processed too
        // TODO: this needs to be tested against various conditions
        //       where this assumption could happen to be false
        let foundIds = _.pluck(txs, 'txid');
        let txsToProcess = _.reject(result.transactions, (tx) => {
          _.contains(foundIds, tx.txid)
        });

        for (let tx of txsToProcess) {
          if (tx.category !== 'receive') continue;
          this._processDepositTx(client, tx);
        }

        // if array size is less than batch then we are either
        // at the end of the list or some of those TXs have been
        // processed already, both situations should terminate the loop
        if (txsToProcess.length < batch) return;
        // otherwise we're continuing the recursion
        this._processDeposits(id, skip + batch, batch);
      });

    })
  }

  _processDepositTx(client, tx) {
    client.getTransaction(tx.txid, (err, result) => {
      let found = 0;
      for (let rawtx of result.details) {
        if (rawtx.category !== 'receive') continue;

        this.models.Wallet.findOne({address: rawtx.address}, (err, wallet) => {
          if (!wallet) return;
          found += 1;

          this._saveDeposit(tx, rawtx, wallet)
        })
      }
      if (found === 0) {
        // something went wrong, no user wallets found for TX
        // TODO: do something with such TXs: alert admins, etc...
        this.logger.error(
          client.currName, '| amount:', tx.amount, '| txid: ', tx.txid,
          '| transaction did not land into user wallet'
        )
      }
    })
  }

  _saveDeposit(tx, rawtx, wallet) {
    // save deposit
    // rawtx is the source of truth for tx amount and destination address
    // tx is the source of truth for other tx details

    let newTx = new this.models.Transaction({
      _id: Random.id(),
      userId: wallet.userId,
      currId: wallet.currId,
      walletId: wallet._id,
      balanceChangeId: null,
      txid: tx.txid,
      address: rawtx.address,
      category: rawtx.category,
      confirmations: tx.confirmations,
      amount: rawtx.amount,
      createdAt: new Date,
      updatedAt: null
    });
    newTx.save((err) => {
      if (err) throw err;
      this._notifyNewTx(newTx);
    });
  }

  _notifyUser(userId, title, message, type) {
    let notification = new this.models.Notification({
      _id: Random.id(),
      userId: userId,
      title: title,
      message: message,
      type: type
    });
    notification.save();
  }

  _notifyNewTx(tx) {
    this.models.Currency.findOne({_id: tx.currId}, (err, curr) => {
      this._notifyUser(
        tx.userId,
        `Incoming: ${tx.amount} ${curr.shortName}`
        `${tx.amount} ${curr.shortName} received at ${tx.address}`,
        'newTransaction'
      );
    })
  }

}

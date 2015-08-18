import {Balance} from './models/balance'
import {BalanceChange} from './models/balance_change'
import {Currency} from './models/currency'
import {Notification} from './models/notification'
import {Transaction} from './models/transaction'
import {Wallet} from './models/wallet'

export class ModelsCollection {
  constructor(mongo) {
    this.Balance = new mongo.model('Balance', Balance);
    this.BalanceChange = new mongo.model('BalanceChange', BalanceChange);
    this.Currency = new mongo.model('Currency', Currency);
    this.Notification = new mongo.model('Notification', Notification);
    this.Transaction = new mongo.model('Transaction', Transaction);
    this.Wallet = new mongo.model('Wallet', Wallet);
  }

  destroy() {
    delete this.mongo.connection.models.Balance;
    delete this.mongo.connection.models.BalanceChange;
    delete this.mongo.connection.models.Currency;
    delete this.mongo.connection.models.Notification;
    delete this.mongo.connection.models.Transaction;
    delete this.mongo.connection.models.Wallet;
  }
}

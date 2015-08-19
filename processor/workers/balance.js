import {BaseWorker} from './base'
import Random from 'meteor-random'
import Big from 'big.js'
import _ from 'underscore'
import {Wallet} from '../models/wallet'
import {Transaction} from '../models/transaction'
import {Notification} from '../models/notification'

export class BalanceWorker extends BaseWorker {
  init() {
    this.name = 'BalanceWorker';
    this.configName = 'balance';
    this.clients = {};
  }

  start() {
    super.start();
  }

  getJobMap() {
    return {
    }
  }

}

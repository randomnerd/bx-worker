var DDP = require('ddp');
var DDPlogin = require('ddp-login');
var config = require('config');
var winston = require('winston');
winston.cli();
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp':true,'colorize':true});

var meteorConfig = config.get('meteorConfig');

var ddp = new DDP({
  host: meteorConfig.host,
  port: meteorConfig.port,
  use_ejson: true,
  autoReconnect: true,
  autoReconnectTimer : 500,
  maintainCollections : true
});

var ddpAuth = {
  method: 'account',
  account: meteorConfig.user,
  pass:    meteorConfig.pass
};

import {Processor} from './processor'
var proc = new Processor(ddp, config, winston);

ddp.connect(function (err, wasReconnect) {
  if (err) { winston.error('DDP connection error:', err); return }
  wasReconnect ? winston.info('DDP Reconnected') : winston.info('DDP Connected');

  DDPlogin(ddp, ddpAuth, function (err, token) {
    if (err) { winston.error('DDP Auth error:', err); throw err; }
    winston.info('DDP Authenticated')

    proc.start();
  });
});

ddp.on('socket-close', (code, message) => {
  if (proc.isRunning) {
    winston.error('DDP Socket closed, stopping workers...');
    proc.stop();
  }
});

import DDP from 'ddp';
import ddpLogin from 'ddp-login';
import config from 'config';
import winston from 'winston';
import {Processor} from './processor';

winston.cli();
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp': true, 'colorize': true});

let meteorConfig = config.get('meteorConfig');

let ddp = new DDP({
  host:                meteorConfig.host,
  port:                meteorConfig.port,
  use_ejson:           true,
  autoReconnect:       true,
  autoReconnectTimer:  500,
  maintainCollections: true
});

let ddpAuth = {
  method:  'account',
  account: meteorConfig.user,
  pass:    meteorConfig.pass
};

let proc = new Processor(ddp, config, winston);

ddp.connect(function(err, wasReconnect) {
  if (err) { winston.error('DDP connection error:', err); return; }
  wasReconnect ? winston.info('DDP Reconnected') : winston.info('DDP Connected');

  ddpLogin(ddp, ddpAuth, function(e) {
    if (err) { winston.error('DDP Auth error:', e); throw e; }
    winston.info('DDP Authenticated');

    proc.start();
  });
});

ddp.on('socket-close', () => { //(code, message)
  if (proc.isRunning) {
    winston.error('DDP Socket closed, stopping workers...');
    proc.stop();
  }
});

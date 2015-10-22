import DDP from 'ddp';
import ddpLogin from 'ddp-login';
import config from 'config';
import logger from './processor/logger';
import {Processor} from './processor';

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

let proc = new Processor(ddp, config, logger);

ddp.connect(function(err, wasReconnect) {
  if (err) {
    logger.error('DDP connection error:', err);
    return;
  }
  wasReconnect ? logger.info('DDP Reconnected') : logger.info('DDP Connected');

  ddpLogin(ddp, ddpAuth, function(e) {
    if (e) {
      logger.error('DDP Auth error:', e);
      throw e;
    }

    logger.info('DDP Authenticated');

    proc.start();
  });
});

ddp.on('socket-close', () => { //(code, message)
  if (proc.isRunning) {
    logger.error('DDP Socket closed, stopping workers...');
    proc.stop();
  }
});

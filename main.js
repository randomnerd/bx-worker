var DDP = require('ddp');
var DDPlogin = require('ddp-login');
var Job = require('meteor-job');
var config = require('config');
var winston = require('winston');
winston.cli();
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp':true,'colorize':true});

var processors = require('./processors');

var meteorConfig = config.get('meteorConfig');
var jobConfig    = config.get('jobConfig');

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

ddp.connect(function (err, wasReconnect) {
  if (err) { winston.error('DDP connection error:', err); return }
  winston.info('DDP Connected');

  DDPlogin(ddp, ddpAuth, function (err, token) {
    if (err) { winston.error('DDP Auth error:', err); throw err; }
    winston.info('DDP Authenticated')

    startProcessing();
  });
});

var startProcessing = function() {
  winston.info('Starting job processing');

  ddp.subscribe(jobConfig.queueName);
  Job.setDDP(ddp);
  setupWorkers(Job);
}

var testjob = function(job, callback) {
  winston.info('Processing job', job._doc._id, 'with data:', job.data);
  job.done();
  callback();
};

var setupWorkers = function(jc) {
  // dont poll, only trigger on actual job added
  q = jc.processJobs(jobConfig.queueName, 'testjob', { pollInterval: 1000000000 }, testjob);
  var observer = ddp.observe([jobConfig.queueName, jobConfig.collectionName].join('.'));
  observer.added = function(id) { winston.info('Queued job:', id); q.trigger(); };
  observer.changed = function() {};
};

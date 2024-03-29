import winston from 'winston';

let logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp: true,
      prettyPrint: true,
      colorize: true
    })
  ]
});

export default logger;

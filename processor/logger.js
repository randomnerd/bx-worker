import winston from 'winston';

winston.cli();
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {timestamp: true, colorize: true});

export default winston;

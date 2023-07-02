import winston from 'winston';

const logger = winston.createLogger({
    format: winston.format.json(),
    // defaultMeta: {service: 'user-service'},
    transports: [
        // - Write all logs with level `error` and below to `error.log`
        new winston.transports.File({
            filename: '../logs/error.log',
            level: 'error',
            colorize: true,
            maxSize: 5242880,
            maxFiles: 10,
        }),
        // - Write all logs with level `info` and below to `combined.log`
        new winston.transports.File({
            filename: '../logs/all.log',
            colorize: true,
            maxSize: 5242880,
            maxFiles: 10,
        }),
    ],
},);

if (process.env.GECO_NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}
// export the logger
export default logger;

import winston from 'winston';

// Format pour capturer les erreurs et leur stack trace
const errorStackFormat = winston.format((info) => {
	if (info instanceof Error) {
		return {
			...info,
			message: info.message,
			stack: info.stack,
		};
	}

	// si une erreur est loggée sous la forme { error: err }
	if (info.error instanceof Error) {
		return {
			...info,
			message: info.error.message,
			stack: info.error.stack,
		};
	}

	return info;
});

// Création du logger principal
const logger = winston.createLogger({
	level: process.env.GECO_NODE_ENV === 'production' ? 'info' : 'debug',
	format: winston.format.combine(errorStackFormat(), winston.format.timestamp(), winston.format.json()),
	transports: [
		new winston.transports.File({
			filename: '../logs/error.log',
			level: 'error',
			colorize: true,
			maxsize: 5242880, // 5 MB
			maxFiles: 10,
		}),
		new winston.transports.File({
			filename: '../logs/all.log',
			level: 'info',
			colorize: true,
			maxsize: 5242880,
			maxFiles: 10,
		}),
	],
});

// Console logger en développement
if (process.env.GECO_NODE_ENV !== 'production') {
	logger.add(
		new winston.transports.Console({
			format: winston.format.combine(
				errorStackFormat(),
				winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
				winston.format.colorize(),
				winston.format.printf((info) => {
					let output = `${info.timestamp} ${info.level}: ${info.message}`;

					// récupérer les arguments supplémentaires (log.error('msg', err, obj, ...))
					const splat = info[Symbol.for('splat')];
					if (splat && splat.length > 0) {
						splat.forEach((item) => {
							if (item instanceof Error) {
								output += `\n${item.stack}`;
							} else if (typeof item === 'object') {
								output += `\n${JSON.stringify(item, null, 2)}`;
							} else {
								output += ` ${item}`;
							}
						});
					}

					// stack trace si l'info elle-même est une erreur
					if (info.stack) {
						output += `\n${info.stack}`;
					}

					return output;
				}),
			),
		})
	);
}

export default logger;

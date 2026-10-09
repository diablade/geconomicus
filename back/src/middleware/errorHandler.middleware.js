import log from '#config/log';
import env from '#config/env';

class AppError extends Error {
	constructor(message, statusCode, context = {}) {
		super(message);
		this.statusCode = statusCode;
		this.context = context;
		this.isOperational = true;

		Error.captureStackTrace(this, this.constructor);
	}
}

const formatErrorForResponse = (err, isDev) => {
	const response = {
		message: err.message || 'Internal Server Error',
		status: err.statusCode || 500,
	};

	if (isDev) {
		response.stack = err.stack;
		response.context = err.context;
	}

	return response;
};

const formatErrorForLogging = (err, req, isDev) => {
	const timestamp = new Date().toISOString();
	const requestInfo = {
		timestamp,
		method: req.method,
		path: req.originalUrl,
		ip: req.ip,
		userAgent: req.get('user-agent'),
		statusCode: err.statusCode || 500,
		message: err.message,
	};

	if (isDev) {
		requestInfo.stack = err.stack;
		requestInfo.context = err.context;
		if (req.body && Object.keys(req.body).length > 0) {
			requestInfo.requestBody = req.body;
		}
		if (req.params && Object.keys(req.params).length > 0) {
			requestInfo.requestParams = req.params;
		}
	}

	return requestInfo;
};

const errorHandler = (err, req, res, next) => {
	const isDev = env.environment !== 'production';

	// Normalize error to AppError format
	let normalizedError = err;
	if (!(err instanceof AppError)) {
		const statusCode = err.statusCode || err.status || 500;
		const message = err.message || 'Internal Server Error';
		normalizedError = new AppError(message, statusCode);
	}

	// Format for logging
	const logData = formatErrorForLogging(normalizedError, req, isDev);

	// Determine log level based on status code
	if (normalizedError.statusCode >= 500) {
		log.error('[ErrorHandler] Server Error', logData);
	} else if (normalizedError.statusCode >= 400) {
		log.warn('[ErrorHandler] Client Error', logData);
	} else {
		log.info('[ErrorHandler] Error occurred', logData);
	}

	// Format response
	const errorResponse = formatErrorForResponse(normalizedError, isDev);

	return res.status(normalizedError.statusCode).json(errorResponse);
};

const asyncHandler = (fn) => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
};

export { errorHandler, asyncHandler, AppError };

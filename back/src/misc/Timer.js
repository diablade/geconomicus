import log from '#config/log';

export default class Timer {
	/**
	 * @param {string} uniqueId
	 * @param {number} duration              - total duration in ms
	 * @param {number|null} heartbeatInterval - heartbeat interval in ms (null = disabled)
	 * @param {number|null} saveInterval      - save interval in ms (null = disabled)
	 * @param {*} data                        - payload
	 * @param {Function|null} callbackAtInterval
	 * @param {Function|null} callbackAtSave
	 * @param {Function} callbackAtEnd
	 */
	constructor(uniqueId, duration, interval, saveInterval, data, callbackAtInterval, callbackAtSave, callbackAtEnd) {
		this.id = uniqueId;
		this.duration = duration;
		this.interval = interval;
		this.saveInterval = saveInterval;
		this.data = data;
		this.callbackAtInterval = callbackAtInterval;
		this.callbackAtSave = callbackAtSave;
		this.callbackAtEnd = callbackAtEnd;

		this._timer = null;
		this._heartbeat = null;
		this._saveHeartbeat = null;

		this.startTime = null;
		this.remainingMs = duration;
		this.status = 'idle'; // idle | running | paused | stopped
	}

	start() {
		if (this.status !== 'idle') return;
		this.startTime = new Date();
		this._startMainTimer();
		this._startHeartbeat();
		this._startSaveHeartbeat();
		this.status = 'running';
		log.debug(`[Timer] ${this.id} started`);
	}

	pause() {
		if (this.status !== 'running') return;
		const elapsed = Date.now() - this.startTime.getTime();
		this.remainingMs = Math.max(0, this.remainingMs - elapsed);
		this.startTime = null;
		this._clearTimers();
		this.status = 'paused';
		log.debug(`[Timer] ${this.id} paused — ${Math.round(this.remainingMs / 1000)}s restants`);
	}

	resume() {
		if (this.status !== 'paused') return;
		this.startTime = new Date();
		this._startMainTimer();
		this._startHeartbeat();
		this._startSaveHeartbeat();
		this.status = 'running';
		log.debug(`[Timer] ${this.id} resumed`);
	}

	stop() {
		if (this.status === 'stopped') return;
		log.debug(`[Timer] ${this.id} stopping...`);
		this._clearTimers();
		this.status = 'stopped';
		log.debug(`[Timer] ${this.id} stopped`);
	}

	getRemainingMs() {
		if (this.status === 'paused') return this.remainingMs;
		if (this.status !== 'running' || !this.startTime) return 0;
		const elapsed = Date.now() - this.startTime.getTime();
		return Math.max(0, this.remainingMs - elapsed);
	}

	// ─── privé ───────────────────────────────────────────────

	_startMainTimer() {
		this._timer = setTimeout(async () => {
			this._clearTimers();
			this.status = 'stopped';
			try {
				await this.callbackAtEnd?.(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackAtEnd error: ${err}`);
			}
		}, this.remainingMs);
	}

	_startHeartbeat() {
		if (!this.interval || !this.callbackAtInterval) return;
		this._heartbeat = setInterval(async () => {
			try {
				await this.callbackAtInterval(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackAtInterval error: ${err}`);
			}
		}, this.interval);
	}

	_startSaveHeartbeat() {
		if (!this.saveInterval || !this.callbackAtSave) return;
		this._saveHeartbeat = setInterval(async () => {
			try {
				await this.callbackAtSave(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackAtSave error: ${err}`);
			}
		}, this.saveInterval);
	}

	_clearTimers() {
		clearTimeout(this._timer);
		clearInterval(this._heartbeat);
		clearInterval(this._saveHeartbeat);
		this._timer = null;
		this._heartbeat = null;
		this._saveHeartbeat = null;
	}
}

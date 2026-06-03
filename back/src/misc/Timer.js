import log from '#config/log';

export default class Timer {
	/**
	 * @param {string} uniqueId
     * @param {*} data                        - payload
	 * @param {number} duration              - total duration in ms
     * @param {Function} callbackAtEnd
	 * @param {number|null} durationInterval1 - duration interval in ms (null = disabled)
     * @param {Function|null} callbackInterval1
     * @param {number|null} durationInterval2 - duration interval in ms (null = disabled)
     * @param {Function|null} callbackInterval2
     * @param {number|null} durationInterval3 - duration interval in ms (null = disabled)
     * @param {Function|null} callbackInterval3
	 */
	constructor(
		uniqueId,
		data,
		duration,
		callbackAtEnd,
		durationInterval1,
		callbackInterval1,
		durationInterval2,
		callbackInterval2,
		durationInterval3,
		callbackInterval3,
	) {
		this.id = uniqueId;
		this.data = data;
		this.duration = duration;
		this.callbackAtEnd = callbackAtEnd;
		this.durationInterval1 = durationInterval1;
		this.callbackInterval1 = callbackInterval1;
		this.durationInterval2 = durationInterval2;
		this.callbackInterval2 = callbackInterval2;
		this.durationInterval3 = durationInterval3;
		this.callbackInterval3 = callbackInterval3;

		this._timer = null;
		this._interval1 = null;
		this._interval2 = null;
		this._interval3 = null;

		this.startTime = null;
		this.remainingMs = duration;
		this.status = 'idle'; // idle | running | paused | stopped
	}

	start() {
		if (this.status !== 'idle') return;
		this.startTime = new Date();
		this.data.startedAt = new Date();
		this._startMainTimer();
		this._startInterval1();
		this._startInterval2();
		this._startInterval3();
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
		this._startInterval1();
		this._startInterval2();
		this._startInterval3();
		this.status = 'running';
		log.debug(`[Timer] ${this.id} resumed`);
	}

	stop() {
		if (this.status === 'stopped') return;
		log.debug(`[Timer] ${this.id} stopping...`);
		this.data.endedAt = new Date();
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
				log.error(`[Timer] ${this.id} callbackAtEnd error: `, err);
			}
		}, this.duration);
	}

	_startInterval1() {
		if (!this.durationInterval1 || !this.callbackInterval1) return;
		this._interval1 = setInterval(async () => {
			try {
				await this.callbackInterval1(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackInterval1 error: `, err);
			}
		}, this.durationInterval1);
	}

	_startInterval2() {
		if (!this.durationInterval2 || !this.callbackInterval2) return;
		this._interval2 = setInterval(async () => {
			try {
				await this.callbackInterval2(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackInterval2 error: `, err);
			}
		}, this.durationInterval2);
	}

	_startInterval3() {
		if (!this.durationInterval3 || !this.callbackInterval3) return;
		this._interval3 = setInterval(async () => {
			try {
				await this.callbackInterval3(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackInterval3 error: `, err);
			}
		}, this.durationInterval3);
	}

	_clearTimers() {
		clearTimeout(this._timer);
		clearInterval(this._interval1);
		clearInterval(this._interval2);
		clearInterval(this._interval3);
		this._timer = null;
		this._interval1 = null;
		this._interval2 = null;
		this._interval3 = null;
	}
}

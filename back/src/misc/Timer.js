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
	 * @param {number|null} durationInterval4 - duration interval in ms (null = disabled)
	 * @param {Function|null} callbackInterval4
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
		durationInterval4,
		callbackInterval4
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
		this.durationInterval4 = durationInterval4;
		this.callbackInterval4 = callbackInterval4;

		this._timer = null;
		this._interval1 = null;
		this._interval2 = null;
		this._interval3 = null;
		this._interval4 = null;

		this.startTime = null;
		this.remainingMs = duration;
		this.status = 'idle'; // idle | running | paused | stopped
	}

	start() {
		if (this.status !== 'idle') return;
		this.data.startedAt = new Date();
		this._launchTimers();
		log.debug(
			`[Timer] STARTED id: ${this.id}, remaining: ${this.remainingMs}ms, interval1: ${this.durationInterval1}ms, interval2: ${this.durationInterval2}ms, interval3: ${this.durationInterval3}ms, interval4: ${this.durationInterval4}ms`
		);
	}

	pause() {
		if (this.status === 'paused') return this.remainingMs;
		if (this.status !== 'running') return this.remainingMs;
		this.updateRemainingMs();
		this.startTime = null;
		this._clearTimers();
		this.status = 'paused';
		log.debug(`[Timer] PAUSED ${this.id}, remaining: ${this.remainingMs}ms`);
		return this.remainingMs;
	}

	resume() {
		log.debug(`[Timer] RESUMING... ${this.id}, duration: ${this.duration}ms, remaining: ${this.remainingMs}ms`);
		if (this.status !== 'paused') return;
		this.duration = this.remainingMs;
		this._launchTimers();
		log.debug(`[Timer] RESUMED ${this.id}`);
	}

	stop() {
		if (this.status === 'stopped') return;
		log.debug(`[Timer] stopping... ${this.id}`);
		this.data.endedAt = new Date();
		this._clearTimers();
		this.status = 'stopped';
		log.debug(`[Timer] STOPPED ${this.id}`);
	}

	getRemainingMs() {
		if (this.status === 'paused') return this.remainingMs;
		if (this.status === 'idle') return this.remainingMs;
		if (this.status !== 'running' || !this.startTime) return 0;
		this.updateRemainingMs();
		return this.remainingMs;
	}

	updateRemainingMs() {
		const now = new Date();
		const elapsed = now.getTime() - this.startTime.getTime();
		this.remainingMs = Math.max(0, this.duration - elapsed);
		this.data.remainingTime = this.remainingMs;
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

	_startInterval4() {
		if (!this.durationInterval4 || !this.callbackInterval4) return;
		this._interval4 = setInterval(async () => {
			try {
				await this.callbackInterval4(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackInterval4 error: `, err);
			}
		}, this.durationInterval4);
	}

	_launchTimers() {
		this.startTime = new Date();
		this._startMainTimer();
		this._startInterval1();
		this._startInterval2();
		this._startInterval3();
		this._startInterval4();
		this.status = 'running';
	}

	_clearTimers() {
		clearTimeout(this._timer);
		if (this._interval1) clearInterval(this._interval1);
		if (this._interval2) clearInterval(this._interval2);
		if (this._interval3) clearInterval(this._interval3);
		if (this._interval4) clearInterval(this._interval4);
		this._timer = null;
		this._interval1 = null;
		this._interval2 = null;
		this._interval3 = null;
		this._interval4 = null;
	}
}

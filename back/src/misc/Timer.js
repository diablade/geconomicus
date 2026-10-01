import log from '#config/log';

const INTERVAL_IDS = [1, 2, 3, 4];

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

		this._intervals = {
			1: { duration: durationInterval1, callback: callbackInterval1 },
			2: { duration: durationInterval2, callback: callbackInterval2 },
			3: { duration: durationInterval3, callback: callbackInterval3 },
			4: { duration: durationInterval4, callback: callbackInterval4 },
		};
		for (const n of INTERVAL_IDS) {
			Object.assign(this._intervals[n], { handle: null, firstHandle: null, firstDelay: null, nextFire: null });
		}

		this._timer = null;

		this.startTime = null;
		this.remainingMs = duration;
		this.status = 'idle'; // idle | running | paused | stopped
	}

	/**
	 * Set the delay (ms) until the FIRST tick of interval `n` after start/resume, so a pause does
	 * not throw away the partial progress of the cycle that was running. Must be called before
	 * start(). A value >= that interval's duration (or null) means "use the full interval".
	 * @param {number} n - interval id (1-4)
	 * @param {number|null} ms
	 */
	setFirstDelay(n, ms) {
		this._intervals[n].firstDelay = ms;
	}

	/**
	 * Remaining ms until the next tick of interval `n`, or its full duration if not yet running.
	 * @param {number} n - interval id (1-4)
	 * @returns {number}
	 */
	getRemainingIntervalMs(n) {
		const interval = this._intervals[n];
		if (!interval.duration) return 0;
		if (interval.nextFire == null) return interval.firstDelay ?? interval.duration;
		return Math.max(0, interval.nextFire - Date.now());
	}

	/**
	 * Re-space an interval's cadence on the fly — used when a Force Death removes an avatar
	 * from the queue and the remaining scheduled deaths must be redistributed over the remaining time.
	 * @param {number} n - interval id (1-4)
	 * @param {number} newDurationMs
	 * @param {number|null} firstDelayMs
	 */
	resetInterval(n, newDurationMs, firstDelayMs = null) {
		const interval = this._intervals[n];
		this._clearInterval(n);
		interval.duration = newDurationMs;
		interval.firstDelay = firstDelayMs;
		interval.nextFire = null;
		if (this.status === 'running') this._startInterval(n);
	}

	start() {
		if (this.status !== 'idle') return;
		this.data.startedAt = new Date();
		this._launchTimers();
		const cadences = INTERVAL_IDS.map((n) => `interval${n}: ${this._intervals[n].duration}ms`).join(', ');
		log.debug(`[Timer] STARTED id: ${this.id}, remaining: ${this.remainingMs}ms, ${cadences}`);
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

	/**
	 * Schedule interval `n`, honouring a firstDelay so a resume fires mid-cycle before falling
	 * back to the normal cadence.
	 * @param {number} n - interval id (1-4)
	 */
	_startInterval(n) {
		const interval = this._intervals[n];
		if (!interval.duration || !interval.callback) return;

		const fire = async () => {
			interval.nextFire = Date.now() + interval.duration;
			try {
				await interval.callback(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackInterval${n} error: `, err);
			}
		};

		const startRecurring = () => {
			interval.nextFire = Date.now() + interval.duration;
			interval.handle = setInterval(fire, interval.duration);
		};

		const firstDelay = interval.firstDelay;
		if (firstDelay != null && firstDelay >= 0 && firstDelay < interval.duration) {
			interval.nextFire = Date.now() + firstDelay;
			interval.firstHandle = setTimeout(async () => {
				await fire();
				startRecurring();
			}, firstDelay);
		} else {
			startRecurring();
		}
	}

	/**
	 * Clear interval `n`'s pending handles, leaving its phase (nextFire) readable.
	 * @param {number} n - interval id (1-4)
	 */
	_clearInterval(n) {
		const interval = this._intervals[n];
		if (interval.handle) clearInterval(interval.handle);
		if (interval.firstHandle) clearTimeout(interval.firstHandle);
		interval.handle = null;
		interval.firstHandle = null;
	}

	_launchTimers() {
		this.startTime = new Date();
		this._startMainTimer();
		for (const n of INTERVAL_IDS) this._startInterval(n);
		this.status = 'running';
	}

	_clearTimers() {
		clearTimeout(this._timer);
		this._timer = null;
		for (const n of INTERVAL_IDS) this._clearInterval(n);
	}
}

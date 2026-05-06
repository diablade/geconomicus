import { addMilliseconds } from 'date-fns';
import log from '#config/log';

export default class Timer {
    /**
     *
     * @param uniqueId of timer
     * @param duration in milliseconds
     * @param interval in millisecinds
     * @param data (payload)
     * @param callbackAtInterval
     * @param callbackAtEnd
     */
	constructor(uniqueId, duration, interval, data, callbackAtInterval, callbackAtEnd) {
		this.id = uniqueId;
        this.duration = duration; // in milliseconds
		this.interval = interval;
		this.data = data;
		this.callbackAtInterval = callbackAtInterval;
		this.callbackAtEnd = callbackAtEnd;

		this._timer = null;
		this._heartbeat = null;
		this.startTime = null;
		this.endTime = null;
		this.remainingMs = duration; // clé pour la pause/resume
		this.status = 'idle'; // idle | running | paused | stopped
	}

	start() {
		this.startTime = new Date();
		// plus de endTime
		this._startMainTimer();
		this._startHeartbeat();
		this.status = 'running';
		log.debug(`[Timer] ${this.id} started`);
	}

	pause() {
		if (this.status !== 'running') return;
		// On recalcule remaining depuis startTime
		const elapsed = Date.now() - this.startTime.getTime();
		this.remainingMs = Math.max(0, this.remainingMs - elapsed);
		this.startTime = null;
		this._clearTimers();
		this.status = 'paused';
		log.debug(`[Timer] ${this.id} paused — ${Math.round(this.remainingMs / 1000)}s restants`);
	}

	resume() {
		if (this.status !== 'paused') return;
		log.debug(`[Timer] ${this.id} resuming...`);
		this.startTime = new Date(); // reset startTime pour la prochaine pause
		this._startMainTimer();
		this._startHeartbeat();
		this.status = 'running';
		log.debug(`[Timer] ${this.id} resumed`);
	}

	getRemainingMs() {
		if (this.status === 'paused') return this.remainingMs;
		if (this.status !== 'running' || !this.startTime) return 0;
		const elapsed = Date.now() - this.startTime.getTime();
		return Math.max(0, this.remainingMs - elapsed);
	}

	stop() {
		log.debug(`[Timer] ${this.id} stopping...`);
		try {
			this._clearTimers();
			this.status = 'stopped';
			log.debug(`[Timer] ${this.id} stopped`);
			return Promise.resolve();
		} catch (err) {
			log.error(`[Timer] Error stopping ${this.id}: ${err}`);
			return Promise.reject(err);
		}
	}

	_startMainTimer() {
		this._timer = setTimeout(async () => {
			this.status = 'stopped';
			try {
				await this.callbackAtEnd(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackAtEnd error: ${err}`);
			}
		}, this.remainingMs);
	}

	_startHeartbeat() {
		this._heartbeat = setInterval(async () => {
			try {
				await this.callbackAtInterval(this);
			} catch (err) {
				log.error(`[Timer] ${this.id} callbackAtInterval error: ${err}`);
			}
		}, this.interval);
	}

	_clearTimers() {
		if (this._timer) {
			clearTimeout(this._timer);
			this._timer = null;
		}
		if (this._heartbeat) {
			clearInterval(this._heartbeat);
			this._heartbeat = null;
		}
	}
}

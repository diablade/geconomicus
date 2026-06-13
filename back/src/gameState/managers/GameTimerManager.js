import log from '#config/log';

class GameTimerManager {
	constructor() {
		if (!GameTimerManager.instance) {
			this.timers = new Map();
			GameTimerManager.instance = this;
		}
		return GameTimerManager.instance;
	}

	getTimer(id) {
		return this.timers.get(id);
	}

	storeTimer(timer) {
		if (this.timers.has(timer.id)) {
			log.error(`[GameTimerManager] Timer ${timer.id} already exists, nothing to store`);
			return;
		}
		this.timers.set(timer.id, timer);
	}

	async startTimer(timer) {
		log.info(`[GameTimerManager] STARTING... for game ${timer.id}`);
		await this.stopAndRemoveTimer(timer.id);
		this.timers.set(timer.id, timer);
		timer.start();
	}

	async pauseTimer(timerId) {
		log.info(`[GameTimerManager] PAUSING... for game ${timerId}`);
		const timer = this.getTimer(timerId);
		if (timer) {
			const remainingTimeMs = timer.pause();
			return remainingTimeMs;
		} else {
			log.error(`[GameTimerManager] Timer ${timerId} not found, nothing to pause`);
			return null;
		}
	}

	async resumeTimer(timerId) {
		log.info(`[GameTimerManager] RESUMING... for game ${timerId}`);
		const storedTimer = this.getTimer(timerId);
		if (!storedTimer) {
			log.error(`[GameTimerManager] Timer ${timerId} not found, cannot resume`);
			return;
		}
		if (storedTimer.status === 'paused') {
			storedTimer.resume();
		} else if (storedTimer.status === 'idle') {
			storedTimer.start();
		} else {
			log.warn(`[GameTimerManager] Timer ${timerId} is in status '${storedTimer.status}', skipping resume`);
		}
	}

	async stopAndRemoveTimer(id) {
		try {
			const timer = this.getTimer(id);
			if (timer) {
				await timer.stop();
				this.timers.delete(id);
				log.debug(`[GameTimerManager] Successfully stopped and removed timer ${id}`);
			} else {
				log.debug(`[GameTimerManager] Timer ${id} not found, nothing to stop`);
			}
			return true;
		} catch (err) {
			log.error(`[GameTimerManager] Unexpected error in stopAndRemoveTimer for ${id}`, err);
			return false;
		}
	}
}

const gameTimerManager = new GameTimerManager();
Object.freeze(gameTimerManager);

export default gameTimerManager;

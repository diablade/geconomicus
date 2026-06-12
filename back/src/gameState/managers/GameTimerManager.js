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
			timer.pause();
		}
	}

	async resumeTimer(timer) {
        log.info(`[GameTimerManager] RESUMING... for game ${timer.id}`);
		const storedTimer = this.getTimer(timer.id);
		if (storedTimer) {
			storedTimer.resume();
		} else {
			this.timers.set(timer.id, timer);
			timer.start();
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

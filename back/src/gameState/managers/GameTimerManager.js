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
        await this.stopAndRemoveTimer(timer.id);
        this.timers.set(timer.id, timer);
		timer.start();
	}

	async pauseTimer(timerId) {
		const timer = this.getTimer(timerId);
		if (timer) {
			timer.pause();
		}
	}

	async resumeTimer(timerId) {
		const timer = this.getTimer(timerId);
		if (timer) {
			timer.resume();
		}
	}

	async stopTimer(timerId) {
		const timer = this.getTimer(timerId);
		if (timer) {
			timer.stop();
		}
	}

	async stopAndRemoveTimer(id) {
		try {
			const timer = this.getTimer(id);
			if (timer) {
				await timer.stop().catch((err) => {
					log.error(`[GameTimerManager] Error stopping timer ${id}: ${err}`);
				});
				this.timers.delete(id);
                log.debug(`[GameTimerManager] Successfully stopped and removed timer ${id}`);
			} else {
				log.debug(`[GameTimerManager] Timer ${id} not found, nothing to stop`);
			}
			return true;
		} catch (err) {
			log.error(`[GameTimerManager] Unexpected error in stopAndRemoveTimer for ${id}: ${err}`);
			return false;
		}
	}
}

const gameTimerManager = new GameTimerManager();
Object.freeze(gameTimerManager);

export default gameTimerManager;

import log from '#config/log';

class CreditTimerManager {
	constructor() {
		if (!CreditTimerManager.instance) {
			this.timers = new Map();
			CreditTimerManager.instance = this;
		}
		return CreditTimerManager.instance;
	}

	async addTimer(timer, startTickNow) {
		await this.stopAndRemoveTimer(timer.id);
		this.timers.set(timer.id, timer);
		if (startTickNow) {
			timer.start();
		}
	}

	getTimer(id) {
		return this.timers.get(id);
	}

	async pauseTimer(id) {
		const timer = this.getTimer(id);
		if (timer) {
			await timer.pause();
		}
	}

	async stopTimer(id) {
		const timer = this.getTimer(id);
		if (timer) {
			timer.stop();
		}
	}

	async stopAndRemoveTimer(id) {
		try {
			const timer = this.getTimer(id);
			if (timer) {
				// Wait for the timer to fully stop
				await timer.stop().catch((err) => {
					log.error(`Error stopping timer ${id}: ${err}`);
				});
				// Remove the timer from the map
				const wasDeleted = this.timers.delete(id);
				if (wasDeleted) {
					log.debug(`Successfully stopped and removed bank timer ${id}`);
				} else {
					log.warn(`Bank timer ${id} not found in timers map when trying to remove`);
				}
			} else {
				log.debug(`Bank timer ${id} not found, nothing to stop`);
			}
			return true;
		} catch (err) {
			log.error(`Unexpected error in stopAndRemoveTimer for bank timer ${id}: ${err}`);
			return false;
		}
	}

	startAllTimersOfGameState(gameStateId) {
		for (const timer of this.timers.values()) {
			if (timer?.data?.gameStateId === gameStateId) {
				timer.start();
			}
		}
	}

	async stopPlayerTimers(gameStateId, playerIdx) {
		const timersToRemove = [];

		// First, collect all timer IDs to remove
		for (const [id, timer] of this.timers.entries()) {
			const data = timer?.data;
			if (data?.gameStateId === gameStateId && (data?.playerIdx === playerIdx || data?.playerStateIdx === playerIdx)) {
				timersToRemove.push(id);
			}
		}

		// Then stop and remove them one by one
		for (const id of timersToRemove) {
			await this.stopAndRemoveTimer(id);
		}
	}

	async stopAndRemoveAllGameTimers(gameStateId) {
		const timersToRemove = [];

		// First, collect all timer IDs to remove
		for (const [id, timer] of this.timers.entries()) {
			if (timer?.data?.gameStateId === gameStateId) {
				timersToRemove.push(id);
			}
		}

		// Then stop and remove them one by one
		for (const id of timersToRemove) {
			await this.stopAndRemoveTimer(id);
		}
	}
}

const creditTimerManager = new CreditTimerManager();
Object.freeze(creditTimerManager);

export default creditTimerManager;

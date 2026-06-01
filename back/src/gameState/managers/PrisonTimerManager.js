import log from '#config/log';

class PrisonTimerManager {
	constructor() {
		if (!PrisonTimerManager.instance) {
			this.timers = new Map();
			PrisonTimerManager.instance = this;
		}
		return PrisonTimerManager.instance;
	}

	async startTimer(timer) {
		await this.stopAndRemoveTimer(timer.id);
		this.timers.set(timer.id, timer);
		timer.start();
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

	async releasePlayer(gameStateId, playerIdx) {
		try {
			const timer = this.getTimer(`${gameStateId}-${playerIdx}`);
			if (timer) {
				// Wait for the timer to fully stop
				await timer.stop().catch((err) => {
					log.error(`[PrisonTimerManager] Error stopping timer ${gameStateId}-${playerIdx}: ${err}`);
				});
				// Remove the timer from the map
				const wasDeleted = this.timers.delete(`${gameStateId}-${playerIdx}`);
				if (wasDeleted) {
					log.debug(`[PrisonTimerManager] Successfully stopped and removed prison timer ${gameStateId}-${playerIdx}`);
				} else {
					log.warn(`[PrisonTimerManager] Prison timer ${id} not found in timers map when trying to remove`);
				}
			} else {
				log.debug(`[PrisonTimerManager] Prison timer ${id} not found, nothing to stop`);
			}
			return true;
		} catch (err) {
			log.error(`[PrisonTimerManager] Unexpected error in stopAndRemoveTimer for prison timer ${id}: ${err}`);
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
			if (timer?.data?.gameStateId === gameStateId && timer?.data?.playerIdx === playerIdx) {
				timersToRemove.push(id);
			}
		}

		// Then stop and remove them one by one
		for (const id of timersToRemove) {
			await this.stopAndRemoveTimer(id);
		}
	}

	async stopAndRemoveAllGameStateTimers(gameStateId) {
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

const prisonTimerManager = new PrisonTimerManager();
Object.freeze(prisonTimerManager);

export default prisonTimerManager;

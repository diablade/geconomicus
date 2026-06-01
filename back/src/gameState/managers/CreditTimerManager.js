import log from '#config/log';

class CreditTimerManager {
	constructor() {
		if (!CreditTimerManager.instance) {
			this.timers = new Map();
			CreditTimerManager.instance = this;
		}
		return CreditTimerManager.instance;
	}

	async startTimer(timer) {
		if (this.timers.has(timer.id)) {
			await this.stopAndRemoveTimer(timer.id);
		}
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
			log.debug(`[CreditTimerManager] Paused credit timer ${id}`);
		}
	}

	async resumeTimer(id) {
		const timer = this.getTimer(id);
		if (timer) {
			await timer.resume();
			log.debug(`[CreditTimerManager] Resumed credit timer ${id}`);
		}
	}

	async stopAndRemoveTimer(timerId) {
		const timer = this.getTimer(timerId) || null;
		if (timer) {
			await timer.stop().catch((err) => log.error(`[CreditTimerManager] Error stopping credit timer ${timerId}: ${err}`));
			this.timers.delete(timerId);
			log.debug(`[CreditTimerManager] Removed credit timer ${timerId}`);
		}
	}

	async stopPlayerTimers(gameStateId, playerIdx) {
		const timersToRemove = [];

		for (const [id, timer] of this.timers.entries()) {
			if (timer.data?.gameStateId === gameStateId && timer.data?.playerIdx === playerIdx) {
				timersToRemove.push(id);
			}
		}

		for (const id of timersToRemove) {
			await this.stopAndRemoveTimer(id);
		}
	}

	async removeGameTimers(gameStateId) {
		log.debug(`[CreditTimerManager] Removing all credit timers for game state ${gameStateId}`);
		const timersToRemove = [];
		for (const [id, timer] of this.timers.entries()) {
			if (timer?.data?.gameStateId === gameStateId) {
				timersToRemove.push(id);
			}
		}

		for (const id of timersToRemove) {
			await this.stopAndRemoveTimer(id);
		}
	}
}

const creditTimerManager = new CreditTimerManager();
Object.freeze(creditTimerManager);

export default creditTimerManager;

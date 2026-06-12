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
		log.debug(`[CreditTimerManager] Starting credit timer ${timer.id}`);
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
		log.debug(`[CreditTimerManager] Pausing credit timer ${id}`);
		const timer = this.getTimer(id);
		if (timer) {
			await timer.pause();
			log.debug(`[CreditTimerManager] Paused credit timer ${id}`);
		}
	}

	async resumeTimer(id) {
		log.debug(`[CreditTimerManager] Resuming credit timer ${id}`);
		const timer = this.getTimer(id);
		if (timer) {
			await timer.resume();
			log.debug(`[CreditTimerManager] Resumed credit timer ${id}`);
		}
	}

	async stopAndRemoveTimer(timerId) {
		log.debug(`[CreditTimerManager] Stopping and removing credit timer ${timerId}`);
		const timer = this.getTimer(timerId) || null;
		if (timer) {
			await timer.stop();
			this.timers.delete(timerId);
			log.debug(`[CreditTimerManager] Removed credit timer ${timerId}`);
		}
	}

	async stopPlayerTimers(gameStateId, playerIdx) {
		log.debug(
			`[CreditTimerManager] Stopping all credit timers for player ${playerIdx} in game state ${gameStateId}`
		);
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

	async pauseGameTimers(gameStateId) {
		log.debug(`[CreditTimerManager] Pausing all credit timers for game state ${gameStateId}`);
		const timersToPause = [];
		for (const [id, timer] of this.timers.entries()) {
			if (timer?.data?.gameStateId === gameStateId) {
				timersToPause.push(id);
			}
		}

		for (const id of timersToPause) {
			await this.pauseTimer(id);
		}
	}

	async removeGameTimers(gameStateId) {
        const timersToRemove = [];
		for (const [id, timer] of this.timers.entries()) {
			if (timer?.data?.gameStateId === gameStateId) {
				timersToRemove.push(id);
			}
		}
		log.debug(
			`[CreditTimerManager] Removing all credit timers for game state ${gameStateId}, (${timersToRemove.length} found)`
		);

		for (const id of timersToRemove) {
			await this.stopAndRemoveTimer(id);
		}
	}
}

const creditTimerManager = new CreditTimerManager();
Object.freeze(creditTimerManager);

export default creditTimerManager;

import log from '#config/log';

class AutoSeizureTimerManager {
	constructor() {
		if (!AutoSeizureTimerManager.instance) {
			this.timers = new Map();
			AutoSeizureTimerManager.instance = this;
		}
		return AutoSeizureTimerManager.instance;
	}

	getTimer(id) {
		return this.timers.get(id);
	}

	has(id) {
		return this.timers.has(id);
	}

	// No-op if a timer already exists for this player — the first fault's deadline stands,
	// later faults are swept into the same batch when it fires (see docs/adr/0005-auto-seizure.md).
	async startIfAbsent(timer) {
		if (this.timers.has(timer.id)) {
			log.debug(`[AutoSeizureTimerManager] Timer ${timer.id} already running, not resetting`);
			return;
		}
		this.timers.set(timer.id, timer);
		timer.start();
	}

	async stopAndRemoveTimer(id) {
		const timer = this.getTimer(id);
		if (timer) {
			await timer.stop();
			this.timers.delete(id);
			log.debug(`[AutoSeizureTimerManager] Stopped and removed timer ${id}`);
		}
	}

	async stopPlayerTimers(gameStateId, playerStateIdx) {
		await this.stopAndRemoveTimer(`${gameStateId}-${playerStateIdx}`);
	}

	async stopAndRemoveAllGameStateTimers(gameStateId) {
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

const autoSeizureTimerManager = new AutoSeizureTimerManager();
Object.freeze(autoSeizureTimerManager);

export default autoSeizureTimerManager;

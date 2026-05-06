class PlayersStateConnectionManager {
	constructor() {
		this.playerConnectionStatus = new Map(); // gameStateId -> Map(playerIdx -> Map{ connected, lastHeartbeat })
	}

	static getInstance() {
		if (!this.instance) {
			this.instance = new PlayersStateConnectionManager();
		}
		return this.instance;
	}

	static ensureGame(gameStateId) {
		if (!this.instance.playerConnectionStatus.has(gameStateId)) {
			this.instance.playerConnectionStatus.set(gameStateId, new Map());
		}
		return this.instance.playerConnectionStatus.get(gameStateId);
	}

	static upsertPlayer(gameStateId, playerIdx, data) {
		const gameMap = this.ensureGame(gameStateId);

		const existing = gameMap.get(playerIdx);

		if (existing) {
			// update partiel (référence)
			Object.assign(existing, data);
		} else {
			// création
			gameMap.set(playerIdx, {
				...data,
				lastSeen: Date.now(),
			});
		}
	}

	static getPlayersConnectionStatus(gameStateId) {
		const gameMap = this.ensureGame(gameStateId);

		return Array.from(gameMap.entries()).map(([idx, existing]) => ({
			idx,
			...existing,
		}));
	}

	static removePlayer(gameStateId, playerIdx) {
		const gameMap = this.ensureGame(gameStateId);
		if (!gameMap) return;

		gameMap.delete(playerIdx);

		if (gameMap.size === 0) {
			this.instance.playerConnectionStatus.delete(gameStateId);
		}
	}

	static removeGame(gameStateId) {
		const gameMap = this.instance.playerConnectionStatus.get(gameStateId);
		if (!gameMap) return;

		gameMap.clear();

		this.instance.playerConnectionStatus.delete(gameStateId);
	}

	static cleanupAll() {
		this.instance.playerConnectionStatus.clear();
	}
}

export default PlayersStateConnectionManager;

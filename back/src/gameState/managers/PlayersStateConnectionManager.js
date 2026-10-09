/**
 * Live device presence per game: gameStateId -> Map(playerIdx -> { isConnected, lastSeen }).
 * Only a connect creates state — a read or a disconnect on an untracked game is a no-op, so a
 * game purged at the end of its round cannot be resurrected by a late-arriving socket event.
 */
class PlayersStateConnectionManager {
	constructor() {
		this.playerConnectionStatus = new Map();
	}

	static getInstance() {
		if (!this.instance) {
			this.instance = new PlayersStateConnectionManager();
		}
		return this.instance;
	}

	/** The player map of a game, created on first connect. */
	static ensureGame(gameStateId) {
		if (!this.instance.playerConnectionStatus.has(gameStateId)) {
			this.instance.playerConnectionStatus.set(gameStateId, new Map());
		}
		return this.instance.playerConnectionStatus.get(gameStateId);
	}

	/** The player map of a game, or null when the game is not tracked. */
	static getGame(gameStateId) {
		return this.instance.playerConnectionStatus.get(gameStateId) || null;
	}

	/** A player's device came online. */
	static markConnected(gameStateId, playerIdx, lastSeen = new Date()) {
		const gameMap = this.ensureGame(gameStateId);
		const existing = gameMap.get(playerIdx);

		if (existing) {
			existing.isConnected = true;
			existing.lastSeen = lastSeen;
		} else {
			gameMap.set(playerIdx, { isConnected: true, lastSeen });
		}
	}

	/** A player's device went offline. An unknown game or player stays unknown. */
	static markDisconnected(gameStateId, playerIdx) {
		const existing = this.getGame(gameStateId)?.get(playerIdx);
		if (existing) existing.isConnected = false;
	}

	static getPlayersConnectionStatus(gameStateId) {
		const gameMap = this.getGame(gameStateId);
		if (!gameMap) return [];

		return Array.from(gameMap.entries()).map(([idx, existing]) => ({
			idx,
			...existing,
		}));
	}

	static removePlayer(gameStateId, playerIdx) {
		const gameMap = this.getGame(gameStateId);
		if (!gameMap) return;

		gameMap.delete(playerIdx);

		if (gameMap.size === 0) {
			this.instance.playerConnectionStatus.delete(gameStateId);
		}
	}

	static removeGame(gameStateId) {
		const gameMap = this.getGame(gameStateId);
		if (!gameMap) return;

		gameMap.clear();

		this.instance.playerConnectionStatus.delete(gameStateId);
	}

	static cleanupAll() {
		this.instance.playerConnectionStatus.clear();
	}
}

export default PlayersStateConnectionManager;

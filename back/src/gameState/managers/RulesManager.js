class RulesManager {
    constructor() {
        this.rulesByGame = new Map();
    }

    _key(sessionId, gameId) {
        return `${sessionId}:${gameId}`;
    }

    setRules(sessionId, gameId, rules) {
        this.rulesByGame.set(this._key(sessionId, gameId), rules);
    }

    getRules(sessionId, gameId) {
        return this.rulesByGame.get(this._key(sessionId, gameId)) || null;
    }

    hasRules(sessionId, gameId) {
        return this.rulesByGame.has(this._key(sessionId, gameId));
    }

    removeRules(sessionId, gameId) {
        this.rulesByGame.delete(this._key(sessionId, gameId));
    }

    clearSession(sessionId) {
        for (const key of this.rulesByGame.keys()) {
            if (key.startsWith(`${sessionId}:`)) {
                this.rulesByGame.delete(key);
            }
        }
    }
}

export default new RulesManager();

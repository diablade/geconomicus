// (ES5 compatible)
const START_GAME = 'start-game';
const STOP_GAME = 'stop-game';
const START_ROUND = 'start-round';
const STOP_ROUND = 'stop-round';
const INTER_TOUR = 'intertour';
const STARTED = 'started';
const EVENT = 'event';
const MASTER = 'master';

if (typeof module !== 'undefined' && module.exports) {
// Export the constants for use in other scripts if needed (for ES6 and later).
    module.exports = {
        START_GAME: START_GAME,
        STOP_GAME: STOP_GAME,
        STOP_GAME: STOP_GAME,
        START_ROUND: START_ROUND,
        STOP_ROUND: STOP_ROUND,
        INTER_TOUR: INTER_TOUR,
        STARTED: STARTED,
        EVENT: EVENT,
        MASTER: MASTER
    };
}


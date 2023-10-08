// (ES5 compatible)
const OPEN = "open";
const START_GAME = 'start-game';
const STOP_GAME = 'stop-game';
const START_ROUND = 'start-round';
const STOP_ROUND = 'stop-round';
const INTER_TOUR = 'intertour';
const STARTED = 'started';
const EVENT = 'event';
const MASTER = 'master';
const DISTRIB_DU = 'distrib_du';
const RESET_GAME= 'reset-game';

if (typeof module !== 'undefined' && module.exports) {
// Export the constants for use in other scripts if needed (for ES6 and later).
    module.exports = {
        OPEN: OPEN,
        START_GAME: START_GAME,
        STOP_GAME: STOP_GAME,
        STOP_GAME: STOP_GAME,
        START_ROUND: START_ROUND,
        STOP_ROUND: STOP_ROUND,
        INTER_TOUR: INTER_TOUR,
        STARTED: STARTED,
        EVENT: EVENT,
        MASTER: MASTER,
        DISTRIB_DU: DISTRIB_DU,
        RESET_GAME:RESET_GAME,
    };
}


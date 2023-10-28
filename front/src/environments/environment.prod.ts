export const environment = {
  production: true,

  API_HOST: 'https://api.geconomicus.fr/',
  WEB_HOST: 'https://geconomicus.fr/',

  PLAYER: {
    JOIN: 'player/join/',
    JOIN_REINCARNATE: 'player/joinReincarnate/',
    JOIN_IN_GAME: 'player/joinInGame/',
    UPDATE: 'player/update',
    GET: 'player/',
    PRODUCE: 'player/produceFromSquare',
    TRANSACTION: 'player/transaction'
  },
  GAME: {
    GET: 'game/',
    CREATE: 'game/create',
    UPDATE: 'game/update',
    EXPORT: 'game/export',
    IMPORT: 'game/import',
    START: 'game/start',
    EVENTS: 'game/events/',
    DELETE_PLAYER: 'game/delete-player',
    KILL_PLAYER: "game/kill-player",
    RESET: 'game/reset',
    START_ROUND: 'game/start-round/',
    STOP_ROUND: 'game/stop-round',
    INTER_ROUND: 'game/inter-round',
    END: 'game/end',
  },
};

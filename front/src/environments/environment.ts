export const environment = {
  production: false,

  API_HOST: 'http://localhost:8080/',
  WEB_HOST: 'http://localhost:4200/',

  PLAYER: {
    JOIN: 'player/join/',
    JOIN_REINCARNATE: 'player/joinReincarnate/',
    JOIN_IN_GAME: 'player/joinInGame/',
    UPDATE: 'player/update',
    GET: 'player/',
    PRODUCE: 'player/produceLevelUp',
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

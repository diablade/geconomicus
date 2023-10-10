export const environment = {
  production: false,
  version: "0.5.2",

  API_HOST: 'http://localhost:8080/',
  WEB_HOST: 'http://localhost:4200/',

  PLAYER: {
    JOIN: 'player/join/',
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
    RESET: 'game/reset',
    START_ROUND: 'game/start-round/',
    STOP_ROUND: 'game/stop-round',
    INTER_ROUND: 'game/inter-round',
    STOP: 'game/stop',
  },
};

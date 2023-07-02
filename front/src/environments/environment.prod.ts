export const environment = {
  production: true,
  version: "0.4.8",

  API_HOST: 'https://api.geconomicus.fr/',
  WEB_HOST: 'https://geconomicus.fr/',

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
    DELETE_PLAYER: 'game/delete-player',
    RESET: 'game/reset',
    START_ROUND: 'game/start-round/',
    STOP_ROUND: 'game/stop-round',
    INTER_ROUND: 'game/inter-round',
    STOP: 'game/stop',
  },
};

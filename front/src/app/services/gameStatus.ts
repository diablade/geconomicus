import { GAME_STATUS } from '@geco/shared';

export interface GameStatusDisplay {
	key: string;
	tone: string;
}

export const PLAYER_GAME_STATUS: Record<string, GameStatusDisplay> = {
	[GAME_STATUS.NONE]: { key: 'AVATAR.ROUND_WAITING', tone: 'tone-waiting' },
	[GAME_STATUS.CREATED]: { key: 'GAME.OPEN', tone: 'tone-open' },
	[GAME_STATUS.INITIALIZED]: { key: 'GAME.OPEN', tone: 'tone-open' },
	[GAME_STATUS.PLAYING]: { key: 'GAME.PLAYING', tone: 'tone-playing' },
	[GAME_STATUS.PAUSED]: { key: 'GAME.PAUSED', tone: 'tone-paused' },
	[GAME_STATUS.STOPPED]: { key: 'GAME.END_GAME', tone: 'tone-ended' },
};

export const MASTER_GAME_STATUS: Record<string, GameStatusDisplay> = {
	[GAME_STATUS.NONE]: { key: 'MASTER.GAME_NOT_PLAYED', tone: 'tone-waiting' },
	[GAME_STATUS.CREATED]: { key: 'MASTER.GAME_OPEN', tone: 'tone-open' },
	[GAME_STATUS.INITIALIZED]: { key: 'MASTER.GAME_OPEN', tone: 'tone-open' },
	[GAME_STATUS.PLAYING]: { key: 'MASTER.GAME_IN_PROGRESS', tone: 'tone-playing' },
	[GAME_STATUS.PAUSED]: { key: 'MASTER.GAME_PAUSED', tone: 'tone-paused' },
	[GAME_STATUS.STOPPED]: { key: 'MASTER.GAME_ENDED', tone: 'tone-ended' },
};


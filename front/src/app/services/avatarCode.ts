export const AVATAR_CODE_PATTERN = /^(\d{4})(?:-(\d{1,2}))?$/;

export const AVATAR_CODE_MAX_LENGTH = 7;

export interface ParsedCode {
	shortId: string;
	avatarIdx: number | null;
}

export function parseCode(raw: string): ParsedCode | null {
	const match = AVATAR_CODE_PATTERN.exec((raw || '').trim());
	if (!match) {
		return null;
	}
	return {
		shortId: match[1],
		avatarIdx: match[2] === undefined ? null : parseInt(match[2], 10),
	};
}

export function formatAvatarCode(shortId: string, avatarIdx: number): string {
	return `${shortId}-${avatarIdx}`;
}

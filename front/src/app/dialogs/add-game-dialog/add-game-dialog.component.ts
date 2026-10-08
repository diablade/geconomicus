import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';
import { GAME_TYPE } from '@geco/shared';
import { SessionService } from '../../services/api/session.service';
import { Session } from '../../models/session';
import { Rules } from '../../models/rules';

/** One row of the session list, as `session/all` projects it. */
interface SessionRow {
	_id: string;
	name: string;
	location: string;
	animator: string;
	gamesRulesCount: number;
	createdAt: string;
}

/** One playable game of the opened session, labelled the way the results page labels it. */
interface GameRow {
	rule: Rules;
	label: string;
	isJune: boolean;
}

export interface AddGamePick {
	session: Session;
	gameStateId: string;
}

/**
 * Picks one game of another session to drop beside the current ones.
 * `session/all` does not project `gamesRules`, so a session's games are only
 * known once it is opened — hence the two steps.
 */
@Component({
	selector: 'app-add-game-dialog',
	templateUrl: './add-game-dialog.component.html',
	styleUrls: ['./add-game-dialog.component.scss'],
})
export class AddGameDialogComponent implements OnInit {
	sessions: SessionRow[] = [];
	filtered: SessionRow[] = [];
	query = '';
	loading = true;
	loadingGames = false;
	openedId = '';
	games: GameRow[] = [];

	private opened?: Session;

	constructor(
		public dialogRef: MatDialogRef<AddGameDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: { excludeSessionId: string; alreadyShown: string[] },
		private sessionService: SessionService
	) {}

	ngOnInit(): void {
		this.sessionService
			.getAll()
			.pipe(catchError(() => of([] as SessionRow[])))
			.subscribe((rows: SessionRow[]) => {
				this.sessions = (rows ?? [])
					.filter((row) => String(row._id) !== this.data.excludeSessionId)
					.filter((row) => row.gamesRulesCount > 0);
				this.filtered = this.sessions;
				this.loading = false;
			});
	}

	/** Narrows the list on name, place or animator. */
	search(): void {
		const q = this.query.trim().toLowerCase();
		this.filtered = q
			? this.sessions.filter((row) =>
					`${row.name ?? ''} ${row.location ?? ''} ${row.animator ?? ''}`.toLowerCase().includes(q)
				)
			: this.sessions;
	}

	/** Loads the games of one session, since the list endpoint does not carry them. */
	open(row: SessionRow): void {
		if (this.openedId === row._id) {
			this.openedId = '';
			this.games = [];
			this.opened = undefined;
			return;
		}
		this.openedId = row._id;
		this.games = [];
		this.opened = undefined;
		this.loadingGames = true;
		this.sessionService
			.getById(row._id)
			.pipe(catchError(() => of(null as Session | null)))
			.subscribe((session) => {
				this.loadingGames = false;
				if (!session) return;
				this.opened = session;
				this.games = this.labelGames(session);
			});
	}

	/** Names each game from its rules order and money type, exactly as the results page does. */
	private labelGames(session: Session): GameRow[] {
		const seen = { debt: 0, june: 0 };
		return (session.gamesRules ?? [])
			.filter((rule) => !!rule.gameStateId)
			.map((rule) => {
				const isJune = rule.typeMoney === GAME_TYPE.JUNE;
				const ordinal = isJune ? ++seen.june : ++seen.debt;
				return { rule, isJune, label: `${isJune ? 'Libre' : 'Dette'} ${ordinal}` };
			});
	}

	alreadyShown(game: GameRow): boolean {
		return this.data.alreadyShown.includes(game.rule.gameStateId);
	}

	pick(game: GameRow): void {
		if (!this.opened || this.alreadyShown(game)) return;
		this.dialogRef.close({ session: this.opened, gameStateId: game.rule.gameStateId } as AddGamePick);
	}
}

import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { combineLatest, map, take } from 'rxjs';
import { CREDIT_QUESTION_ANSWER, GAME_STATUS, GAME_TYPE, PLAYER_STATUS } from '@geco/shared';
import { GameStateService } from '../../services/api/game-state.service';
import { SnackbarService } from '../../services/snackbar.service';
import { I18nService } from '../../services/i18n.service';
import { AudioService } from '../../services/audio.service';
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog/confirm-dialog.component';

@Component({
	selector: 'app-game-controls',
	templateUrl: './game-controls.component.html',
})
export class GameControlsComponent {
	@Input() gameStateId = '';

	protected readonly INITIALIZED = GAME_STATUS.INITIALIZED;
	protected readonly PLAYING = GAME_STATUS.PLAYING;
	protected readonly PAUSED = GAME_STATUS.PAUSED;
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly AVG_MONEY_TARGET = 2;

	gameState$ = this.gameStateService.gameState$;
	rules$ = this.gameStateService.rules$;
	playersAC$ = this.gameStateService.playersAC$;

	avgMoney$ = combineLatest([this.gameState$, this.playersAC$]).pipe(
		map(([gs, players]) => {
			const alive = (players || []).filter((p: any) => p.status !== PLAYER_STATUS.DEAD);
			return alive.length ? (gs?.currentMassMonetary || 0) / alive.length : 0;
		})
	);

	pendingFirstCredit$ = this.playersAC$.pipe(
		map(
			(players: any[]) =>
				(players || []).filter(
					(p: any) =>
						p.status !== PLAYER_STATUS.DEAD && p.firstCreditAnswer === CREDIT_QUESTION_ANSWER.PENDING
				).length
		)
	);

	vm$ = combineLatest({
		gameState: this.gameState$,
		rules: this.rules$,
		avgMoney: this.avgMoney$,
	});

	constructor(
		private gameStateService: GameStateService,
		private snackbarService: SnackbarService,
		private i18nService: I18nService,
		private audioService: AudioService,
		public dialog: MatDialog
	) {
		this.i18nService.loadNamespace('master');
	}

	/** Starts or resumes the round, warning first when money is low or first-credit answers are missing. */
	launchGame(status: string) {
		if (status !== this.INITIALIZED) {
			this.doLaunchGame(status);
			return;
		}
		combineLatest([this.rules$, this.avgMoney$, this.pendingFirstCredit$])
			.pipe(take(1))
			.subscribe(([rules, avgMoney, pending]) => {
				const lowMoney = rules.typeMoney === this.DEBT && avgMoney < this.AVG_MONEY_TARGET;
				const missing = rules.typeMoney === this.DEBT ? pending : 0;
				if (!lowMoney && !missing) {
					this.doLaunchGame(status);
					return;
				}
				const confirmRef = this.dialog.open(ConfirmDialogComponent, {
					data: {
						title: this.i18nService.instant('MASTER.START_GAME'),
						message: lowMoney
							? this.i18nService.instant('MASTER.LOW_AVG_WARNING', {
									avg: avgMoney.toFixed(2),
									target: this.AVG_MONEY_TARGET,
							  })
							: '',
						message2: missing
							? this.i18nService.instant('MASTER.START_PENDING_ANSWERS', { missing })
							: '',
						labelBtnConfirm: this.i18nService.instant('MASTER.START_GAME'),
					},
				});
				confirmRef.afterClosed().subscribe((result) => {
					if (result === 'btnConfirm') this.doLaunchGame(status);
				});
			});
	}

	/** Calls the start or resume endpoint and restarts the shared timer. */
	private doLaunchGame(status: string) {
		const call =
			status === this.INITIALIZED
				? this.gameStateService.startGame(this.gameStateId)
				: this.gameStateService.resumeGame(this.gameStateId);
		const message = status === this.INITIALIZED ? 'MASTER.GAME_STARTED' : 'MASTER.GAME_RESUMED';
		call.subscribe({
			next: (result) => {
				this.rules$.pipe(take(1)).subscribe((rules) => {
					this.snackbarService.showSuccess(this.i18nService.instant(message));
					this.audioService.playSound('start');
					const remainingMs = result?.remainingTimeMs || rules.roundMinutes * 60 * 1000;
					this.gameStateService.startTimer(remainingMs);
				});
			},
			error: (error) => {
				this.snackbarService.showError(this.i18nService.instant(error.message));
			},
		});
	}

	/** Ends the round after confirmation. */
	stopGame() {
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				message: this.i18nService.instant('EVENTS.ASK_END_ROUND'),
			},
		});
		confDialogRef.afterClosed().subscribe((result) => {
			if (result && result == 'btnConfirm') {
				this.gameStateService.stopGame(this.gameStateId).subscribe(() => {
					this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_ENDED'));
					this.gameStateService.stopTimer();
				});
			}
		});
	}

	/** Pauses the round and the shared timer. */
	pauseGame() {
		this.gameStateService.pauseGame(this.gameStateId).subscribe({
			next: () => {
				this.snackbarService.showSuccess(this.i18nService.instant('MASTER.GAME_PAUSED'));
				this.gameStateService.pauseTimer();
			},
			error: (error) => {
				this.snackbarService.showError(this.i18nService.instant(error.message));
			},
		});
	}
}

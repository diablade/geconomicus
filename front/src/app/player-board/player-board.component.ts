import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import confetti from 'canvas-confetti';
import { combineLatest, distinctUntilChanged, map, Subscription, withLatestFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { Card, Credit, ConnectionStatus } from '../models/gameState';
import { MatDialog } from '@angular/material/dialog';
import { I18nService } from '../services/i18n.service';
import * as _ from 'lodash-es';
import { faClipboardCheck, faFileContract, faCreditCardAlt, faFileSignature } from '@fortawesome/free-solid-svg-icons';
import { SnackbarService } from '../services/snackbar.service';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { ActionDialogComponent } from '../dialogs/action-dialog/action-dialog.component';
import { ScannerQrCode } from '../dialogs/scanner-qr-code/scanner-qr-code.component';
import {
	AssistMode,
	ASSIST_MODE,
	CREDIT_QUESTION_ANSWER,
	CREDIT_STATUS,
	GAME_STATUS,
	GAME_TYPE,
	PLAYER_STATUS,
} from '@geco/shared';
import { ShortCode } from '../models/shortCode';
import { Recipe, getAvailableRecipes } from '../models/recipe';
import { ShortcodeDialogComponent } from '../dialogs/shortcode-dialog/shortcode-dialog.component';
import { GameInfosDialog } from '../components/notice-btn/notice-btn.component';
import { LocalStorageService } from '../services/local-storage/local-storage.service';
import { AudioService } from '../services/audio.service';
import { animations } from '../services/animations';
import { ThemesService } from '../services/themes.service';
import { getBackgroundStyle } from '../services/avatarTools';
import { AvatarService } from '../services/api/avatar.service';
import { PlayerStateService } from '../services/api/player-state.service';
import { DeckService } from '../services/api/deck.service';
import { Rules } from '../models/rules';
import { OverlayConfig } from '../components/overlay/overlay.component';
import { makeFakeAvatar, makeFakeBundle } from '../fake/fake-data';

@Component({
	selector: 'app-player-board',
	templateUrl: './player-board.component.html',
	animations,
	styleUrls: ['./player-board.component.scss'],
})
export class PlayerBoardComponent implements OnInit, OnDestroy {
	protected readonly PLAYING = GAME_STATUS.PLAYING;
	protected readonly PRISON = PLAYER_STATUS.PRISON;
	protected readonly DEAD = PLAYER_STATUS.DEAD;
	protected readonly ALIVE = PLAYER_STATUS.ALIVE;
	protected readonly ANSWER = CREDIT_QUESTION_ANSWER;
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly DEBT = GAME_TYPE.DEBT;
	protected readonly STOPPED = GAME_STATUS.STOPPED;
	protected readonly faFileContract = faFileContract;
	protected readonly faClipboardCheck = faClipboardCheck;
	protected readonly faCreditCardAlt = faCreditCardAlt;
	protected readonly faFileSignature = faFileSignature;
	protected readonly getBackgroundStyle = getBackgroundStyle;
	private subscription: Subscription | undefined;

	screenWidth = 0;
	screenHeight = 0;

	get isLandscape(): boolean {
		return this.screenWidth > this.screenHeight;
	}

	sessionId: string | undefined;
	gameStateId: string | undefined;
	avatarIdx: number | undefined;
	playerStateIdx: number | undefined;
	assistMode: AssistMode | null = null;

	typeTheme$ = inject(ThemesService).typeTheme$;
	theme: string = this.themesService.getCurrentTheme();
	avatar$ = inject(AvatarService).avatar$;
	session$ = inject(AvatarService).session$;
	playerStatus$ = inject(PlayerStateService).playerStatus$;
	playerConnection$ = inject(PlayerStateService).playerConnection$;
	takenOver$ = inject(PlayerStateService).takenOver$;
	prison$ = inject(PlayerStateService).prison$;

	coins$ = inject(PlayerStateService).coins$;
	cards$ = inject(PlayerStateService).cards$;
	credits_NotOrdered$ = inject(PlayerStateService).credits$;
	rate$ = inject(PlayerStateService).rate$;
	firstCreditQuestion$ = inject(PlayerStateService).firstCreditQuestion$;

	order = (status: string): number => {
		switch (status) {
			case CREDIT_STATUS.REQUESTING:
				return 0;
			case CREDIT_STATUS.RUNNING:
				return 1;
			case CREDIT_STATUS.PAUSED:
				return 2;
			case CREDIT_STATUS.IDLE:
				return 3;
			case CREDIT_STATUS.DONE:
				return 4;
			default:
				return 999;
		}
	};
	credits$ = this.credits_NotOrdered$.pipe(
		map((credits) => {
			return [...credits].filter((c) => c.status !== CREDIT_STATUS.DONE).sort((a, b) => {
				return this.order(a.status) - this.order(b.status);
			});
		})
	);
	gameState$ = inject(PlayerStateService).gameState$;
	rules$ = inject(PlayerStateService).rules$;
	cardsView$ = combineLatest([this.cards$, this.rules$]).pipe(
		map(([cards, rules]) => {
			const recipes = getAvailableRecipes(
				cards,
				rules.amountCardsForProd,
				rules.generatedIdenticalLetters
			).filter((r) => r.completed);

			const usedKeys = new Set<string>();
			const groups = recipes.map((recipe) => {
				const matchKeys = new Set(recipe.ingredients.filter((i) => i.have > 0).map((i) => i.key));
				const groupCards = cards.filter((c) => matchKeys.has(c.key)).slice(0, rules.amountCardsForProd);
				groupCards.forEach((c) => usedKeys.add(c.key));
				return { recipe, cards: groupCards };
			});

			const remaining = cards.filter((c) => !usedKeys.has(c.key));
			return { groups, remaining };
		})
	);

	get warningCredit$() {
		return this.credits$.pipe(map((credits) => credits.some((credit) => credit.status === CREDIT_STATUS.FAULT)));
	}

	actionTokens$ = inject(PlayerStateService).actionTokens$;
	sessionAvatars$ = inject(PlayerStateService).avatars$;

	vm$ = combineLatest({
		playerStatus: this.playerStatus$,
		coins: this.coins$,
		cards: this.cards$,
		gameState: this.gameState$,
		rules: this.rules$,
		credits: this.credits$,
		avatar: this.avatar$,
		session: this.session$,
		typeTheme: this.typeTheme$,
		actionTokens: this.actionTokens$,
		sessionAvatars: this.sessionAvatars$,
		rate: this.rate$,
	});

	reincarnateConfig: OverlayConfig | null = null;
	private pendingReincarnateIdx: number | null = null;
	private reincarnationSub: Subscription | undefined;
	private readonly REINCARNATE_OVERLAY_MS = 4000;
	alarmConfig: OverlayConfig | null = null;
	private finalMinuteSub: Subscription | undefined;
	private readonly CREDIT_ALARM_MS = 4000;
	faultConfig: OverlayConfig | null = null;
	private autoSeizure = false;
	private creditFaultSub: Subscription | undefined;
	private rulesSub: Subscription | undefined;
	readonly takeoverConfig: OverlayConfig = {
		phases: [
			{
				icon: '🎬',
				title: 'PLAYER.TAKEN_OVER_TITLE',
				text: 'PLAYER.TAKEN_OVER_TEXT',
				bg: 'takeover',
				button: { labelKey: 'PLAYER.RETAKE' },
			},
		],
	};

	fakeMode = false;
	scanV3 = true;
	flipCoin = false;
	panelCreditOpenState = false;
	panelRecipeOpenState = false;
	shortCode: ShortCode | undefined;
	isBuying = false;
	isProducing = false;
	playerConnection: ConnectionStatus | null = null;

	currentDebts = (credits: Credit[]): number => {
		return credits
			.filter((c) => c.status !== CREDIT_STATUS.DONE && c.status !== CREDIT_STATUS.CANCELED)
			.reduce((total, c) => total + c.amount + c.interest, 0);
	};

	recipies = (cards: Card[], rules: Rules) => {
		return getAvailableRecipes(cards, rules.amountCardsForProd, rules.generatedIdenticalLetters);
	};

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		public dialog: MatDialog,
		private localStorageService: LocalStorageService,
		private deckService: DeckService,
		private i18nService: I18nService,
		private themesService: ThemesService,
		private audioService: AudioService,
		private snackbarService: SnackbarService,
		private avatarService: AvatarService,
		private playerStateService: PlayerStateService
	) {
		this.i18nService.loadNamespace('player');
		this.i18nService.loadNamespace('action');
	}

	ngOnDestroy(): void {
		this.playerStateService.leaveRooms();
		this.playerStateService.offAll();
		if (this.subscription) this.subscription.unsubscribe();
		if (this.reincarnationSub) this.reincarnationSub.unsubscribe();
		if (this.finalMinuteSub) this.finalMinuteSub.unsubscribe();
		if (this.creditFaultSub) this.creditFaultSub.unsubscribe();
		if (this.rulesSub) this.rulesSub.unsubscribe();
		window.removeEventListener('resize', this._resizeHandler);
	}

	ngOnInit(): void {
		this.fakeMode = this.route.snapshot.data['fake'] === true;

		this.coins$.subscribe(() => {
			this.flipCoins();
		});

		this.updateScreenSize();
		this.scanV3 = this.localStorageService.getItem('scanV3');

		this.reincarnationSub = this.playerStateService.reincarnation$.subscribe((data) => {
			this.playReincarnationOverlay(data.newPlayerStateIdx);
		});

		this.finalMinuteSub = this.playerStateService.finalMinute$.subscribe(({ flash }) => {
			this.onCreditFinalMinute(flash);
		});

		this.creditFaultSub = this.warningCredit$
			.pipe(distinctUntilChanged())
			.subscribe((fault) => this.onCreditFault(fault));

		this.rulesSub = this.rules$.subscribe((r) => (this.autoSeizure = !!r?.autoSeizure));

		if (this.fakeMode) {
			this.bootFake();
			return;
		}

		const rawAssist = this.route.snapshot.queryParamMap.get('assist');
		this.assistMode =
			rawAssist && Object.values(ASSIST_MODE).includes(rawAssist as AssistMode)
				? (rawAssist as AssistMode)
				: null;

		this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = params['avatarIdx'];
			this.gameStateId = params['gameStateId'];
			this.playerStateIdx = params['playerStateIdx'];

			if (this.sessionId && this.gameStateId && this.avatarIdx != undefined && this.playerStateIdx != undefined) {
				this.playerStateService.loadPlayerState(
					this.sessionId,
					this.gameStateId,
					this.avatarIdx,
					this.playerStateIdx
				);
				this.avatarService.loadAvatar(this.sessionId, this.avatarIdx, true, this.assistMode).subscribe();
			}
		});
	}

	private bootFake(): void {
		this.sessionId = 'fake';
		this.gameStateId = 'fake';
		this.avatarIdx = 0;
		this.playerStateIdx = 0;
		this.themesService.loadTheme('THEME.EMOJIS');
		this.avatarService.loadFakeAvatar(makeFakeAvatar());
		this.playerStateService.loadFake(makeFakeBundle(GAME_TYPE.DEBT, false));
	}

	retake(): void {
		this.playerStateService.retake();
	}

	private _resizeHandler = () => {
		this.screenWidth = window.innerWidth;
		this.screenHeight = window.innerHeight;
	};

	updateScreenSize() {
		this._resizeHandler();
		window.addEventListener('resize', this._resizeHandler);
	}

	initPanels() {
		const panelC = this.localStorageService.getItem('panelCredit');
		const panelR = this.localStorageService.getItem('panelRecipe');
		this.panelCreditOpenState = panelC == undefined ? false : panelC;
		this.panelRecipeOpenState = panelR == undefined ? false : panelR;
		this.gameState$.pipe(withLatestFrom(this.typeTheme$)).subscribe(([gameState, typeTheme]) => {
			if (gameState.typeMoney === GAME_TYPE.JUNE) {
				this.localStorageService.setItem('panelCredit', false);
				if (typeTheme === 'CARD') {
					this.localStorageService.setItem('panelRecipe', false);
					this.panelRecipeOpenState = false;
				} else {
					this.localStorageService.setItem('panelRecipe', this.panelRecipeOpenState);
				}
			} else {
				this.localStorageService.setItem('panelCredit', this.panelCreditOpenState);
				if (typeTheme === 'CARD') {
					this.localStorageService.setItem('panelRecipe', false);
					this.panelRecipeOpenState = false;
				} else {
					this.localStorageService.setItem('panelRecipe', this.panelRecipeOpenState);
				}
				this.playerStateService.refreshRate();
			}
		});
	}

	flipCoins() {
		this.flipCoin = true;
		setTimeout(() => {
			this.flipCoin = false;
		}, 1000);
	}

	produceLevelUp($event: any) {
		if (this.fakeMode) return;
		this.playerStateService.produce($event.letter, $event.weight);
	}

	trackByGroup(index: number, group: { recipe: Recipe; cards: Card[] }): string {
		return group.recipe.letter + group.recipe.weight;
	}

	scan() {
		const dialogRef = this.dialog.open(ScannerQrCode, {});
		dialogRef.afterClosed().subscribe((dataRaw) => {
			if (dataRaw) {
				this.buy(dataRaw);
			}
		});
	}

	buyWith() {
		if (this.fakeMode) {
			this.openDialogShorCode();
			return;
		}
		if (this.scanV3) {
			this.scan();
		} else {
			this.openDialogShorCode();
		}
	}

	buyWithCode(code: string) {
		this.playerStateService.sendBuyingShortCode(code);
		this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.SHORT_CODE_SEND'));
	}

	buy(dataRaw: any) {
		if (this.isBuying) {
			return;
		}
		this.isBuying = true;

		this.playerStateService.buy(dataRaw).subscribe({
			next: (result) => {
				if (result.success) {
					this.audioService.playSound('cardFlipBack');
				} else {
					this.snackbarService.showError(this.i18nService.instant(result.error || 'ERROR.UNKNOWN'));
					this.audioService.playSound('error');
				}
				this.isBuying = false;
			},
			error: () => {
				this.snackbarService.showError(this.i18nService.instant('ERROR.UNKNOWN'));
				this.audioService.playSound('error');
				this.isBuying = false;
			},
		});
	}

	creditActionBtn($event: string, credit: Credit) {
		if (this.fakeMode) return;
		if ($event == 'settle') {
			const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
				data: {
					message: this.i18nService.instant('DIALOG.CREDIT_SETTLE.MESSAGE', {
						amount: credit.amount + credit.interest,
					}),
					labelBtnConfirm: this.i18nService.instant('DIALOG.CREDIT_SETTLE.BTN_CONFIRM'),
					styleBtnConfirm: 'warn',
				},
			});
			confDialogRef.afterClosed().subscribe((result) => {
				if (result && result == 'btnConfirm') {
					this.playerStateService.settleCredit(credit);
				}
			});
		} else if ($event == 'answer') {
			this.playerStateService.confirmSettleOrExtend(credit);
		}
	}

	requestCredit(amount: number, interest: number) {
		if (this.fakeMode) return;
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant('DIALOG.REQUEST_CREDIT.TITLE'),
				message: this.i18nService.instant('DIALOG.REQUEST_CREDIT.MESSAGE', {
					amount, interest
				}),
				message2: this.i18nService.instant('DIALOG.REQUEST_CREDIT.MESSAGE2', {
					total: amount + interest,
					rate: Math.floor(interest / amount * 100)
				}),
				labelBtnConfirm: this.i18nService.instant('DIALOG.REQUEST_CREDIT.BTN_CONFIRM'),
				styleBtnConfirm: 'warn',
			},
		});
		confDialogRef.afterClosed().subscribe((result) => {
			if (result && result == 'btnConfirm') {
				this.playerStateService.requestCredit(amount, interest);
			}
		});
	}

	answerFirstCredit(answer: string) {
		if (this.fakeMode) return;
		this.playerStateService.answerFirstCreditQuestion(answer);
	}

	private playReincarnationOverlay(newPlayerStateIdx: number) {
		if (this.reincarnateConfig) return;
		this.pendingReincarnateIdx = newPlayerStateIdx;
		this.reincarnateConfig = {
			phases: [
				{
					icon: '☠️',
					text: 'PLAYER.THIS_LIFE_IS_GONE',
					bg: 'reincarnate-death',
					sound: 'dead',
					durationMs: this.REINCARNATE_OVERLAY_MS,
				},
				{
					icon: '👶',
					text: 'PLAYER.GO_TO_SECOND_LIFE',
					bg: 'reincarnate-rebirth',
					sound: 'angel',
					durationMs: this.REINCARNATE_OVERLAY_MS,
				},
			],
		};
	}

	onReincarnateDone(): void {
		const idx = this.pendingReincarnateIdx;
		this.pendingReincarnateIdx = null;
		if (idx == null) {
			this.reincarnateConfig = null;
			return;
		}
		this.router
			.navigate(['/player', this.sessionId, this.avatarIdx, this.gameStateId, idx])
			.finally(() => (this.reincarnateConfig = null));
	}

	private onCreditFinalMinute(flash: boolean): void {
		if (!this.panelCreditOpenState) {
			this.panelCreditOpenState = true;
			this.localStorageService.setItem('panelCredit', true);
		}
		if (flash && !this.alarmConfig) {
			this.alarmConfig = {
				phases: [{ icon: '⏰', text: 'CREDIT.FINAL_MINUTE', bg: 'alarm', durationMs: this.CREDIT_ALARM_MS }],
			};
		}
	}

	private onCreditFault(fault: boolean): void {
		if (fault) {
			this.faultConfig = {
				loop: true,
				phases: [
					{
						icon: '🚨',
						title: 'CREDIT.FAULT_OVERLAY_TITLE',
						text: this.autoSeizure ? 'CREDIT.FAULT_OVERLAY_TEXT_AUTO' : 'CREDIT.FAULT_OVERLAY_TEXT',
						bg: 'police',
					},
				],
			};
			this.audioService.playSound('police');
		} else {
			this.faultConfig = null;
			this.audioService.stopSound('police');
		}
	}

	tryReincarnate() {
		if (!this.sessionId || !this.gameStateId || this.avatarIdx == undefined) return;
		this.avatarService.getCurrentPlayerStateIdx(this.sessionId, this.gameStateId, this.avatarIdx).subscribe({
			next: (data) => {
				if (data?.idx != undefined && data.idx !== -1 && data.idx != this.playerStateIdx) {
					this.router.navigate(['/player', this.sessionId, this.avatarIdx, this.gameStateId, data.idx]);
				} else {
					this.snackbarService.showError(this.i18nService.instant('ERROR.UNKNOWN'));
				}
			},
			error: () => this.snackbarService.showError(this.i18nService.instant('ERROR.UNKNOWN')),
		});
	}

	openActionDialog(vm: any) {
		this.dialog
			.open(ActionDialogComponent, {
				data: {
					gameStateId: this.gameStateId,
					gameStatus: vm.gameState.status,
					sessionId: this.sessionId,
					playerStateIdx: this.playerStateIdx,
					actionTokens: vm.actionTokens,
					actions: vm.rules.actions || [],
					myCards: vm.cards,
					typeMoney: vm.gameState.typeMoney,
					currentDU: vm.gameState.currentDU,
					typeTheme: vm.typeTheme,
					sessionAvatars: vm.sessionAvatars || [],
					fake: this.fakeMode,
				},
				panelClass: 'action-dialog-panel',
			})
			.afterClosed()
			.subscribe((result) => {
				if (result?.success) {
					this.playerStateService.refreshActionResult(result);
				}
			});
	}

	onChangedShortCode($event: any) {
		this.playerStateService.shortCode = $event;
	}

	openDialogShorCode() {
		const shortCodeDialogRef = this.dialog.open(ShortcodeDialogComponent);
		shortCodeDialogRef.afterClosed().subscribe((code) => {
			if (code && !this.fakeMode) {
				this.buyWithCode(code);
			}
		});
	}

	refresh() {
		window.location.reload();
	}

	showRules() {
		this.dialog.open(GameInfosDialog, {});
	}

	togglePanel(panel: string) {
		if (panel == 'credit') {
			this.panelCreditOpenState = !this.panelCreditOpenState;
			this.localStorageService.setItem('panelCredit', this.panelCreditOpenState);
			if (this.panelCreditOpenState && !this.fakeMode) this.playerStateService.refreshRate();
		} else if (panel == 'recipe') {
			this.panelRecipeOpenState = !this.panelRecipeOpenState;
			this.localStorageService.setItem('panelRecipe', this.panelRecipeOpenState);
		}
	}

	onRecipeCompleted(recipe: Recipe) {
		console.log(recipe);
	}

	recipeCompleted(recipe: Recipe) {
		if (recipe.completed && recipe.ingredients.some((i) => i.have > 0)) {
			this.produceLevelUp({ letter: recipe.letter, weight: recipe.weight });
		}
	}

	trackByCard(index: number, card: Card): string {
		return card.key;
	}
}

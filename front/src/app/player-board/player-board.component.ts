import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { combineLatest, map, Subscription, withLatestFrom } from 'rxjs';
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
import createCountdown from '../services/countDown';
import { LocalStorageService } from '../services/local-storage/local-storage.service';
import { AudioService } from '../services/audio.service';
import { animations } from '../services/animations';
import { ThemesService } from '../services/themes.service';
import { getBackgroundStyle } from '../services/avatarTools';
import { AvatarService } from '../services/api/avatar.service';
import { PlayerStateService } from '../services/api/player-state.service';
import { DeckService } from '../services/api/deck.service';
import { Rules } from '../models/rules';

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
	giftReceived = false;

	get isLandscape(): boolean {
		return this.screenWidth > this.screenHeight;
	}

	sessionId: string | undefined;
	gameStateId: string | undefined;
	avatarIdx: number | undefined;
	playerStateIdx: number | undefined;
	// Set when this tab is an animator's assist session (?assist=coexist|takeover|kick).
	assistMode: AssistMode | null = null;

	typeTheme$ = inject(ThemesService).typeTheme$;
	theme: string = this.themesService.getCurrentTheme();
	avatar$ = inject(AvatarService).avatar$;
	session$ = inject(AvatarService).session$;
	playerStatus$ = inject(PlayerStateService).playerStatus$;
	playerConnection$ = inject(PlayerStateService).playerConnection$;
	takenOver$ = inject(PlayerStateService).takenOver$;

	coins$ = inject(PlayerStateService).coins$;
	cards$ = inject(PlayerStateService).cards$;
	credits_NotOrdered$ = inject(PlayerStateService).credits$;
	// Auto-bank: current effective rate on offer (for the persistent rate chip).
	rate$ = inject(PlayerStateService).rate$;
	// Auto-bank: opening First Credit Question prompt (drives the blocking overlay).
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
			return [...credits].sort((a, b) => {
				return this.order(a.status) - this.order(b.status);
			});
		})
	);
	gameState$ = inject(PlayerStateService).gameState$;
	rules$ = inject(PlayerStateService).rules$;

	// Carrés complets (4 cartes distinctes même lettre / même niveau), thème item/emoji uniquement.
	// Les cartes d'un groupe complet sont retirées de `remaining` : elles ne sont donc rendues
	// qu'une seule fois, à l'intérieur de la zone chantier — jamais dans la grille normale.
	// Le thème CARD garde son propre bouton de construction existant, inchangé.
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

	// Death→rebirth overlay state (skull → sprout, ~2.5s, then auto-navigate to the new life).
	isReincarnating = false;
	reincarnatePhase: 'death' | 'rebirth' = 'death';
	private reincarnationSub: Subscription | undefined;
	private readonly REINCARNATE_OVERLAY_MS = 4000;

	scanV3 = true;
	flipCoin = false;
	panelCreditOpenState = false;
	panelRecipeOpenState = false;
	defaultCredit = false;
	prisonProgress = 0;
	minutesPrison = 5;
	secondsPrison = 0;
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

	prisonTimer = createCountdown(
		{ h: 0, m: 0, s: 0 },
		{
			listen: ({ hh, mm, ss, s, h, m }) => {
				this.minutesPrison = m;
				this.secondsPrison = s;
			},
			done: () => {
				this.snackbarService.showSuccess(this.i18nService.instant('EVENTS.PRISON_END'));
			},
		}
	);

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
		window.removeEventListener('resize', this._resizeHandler);
	}

	ngOnInit(): void {
		this.coins$.subscribe(() => {
			this.flipCoins();
		});

		this.updateScreenSize();
		this.scanV3 = this.localStorageService.getItem('scanV3');

		// Death → rebirth: play the overlay, then move this device to the new life.
		this.reincarnationSub = this.playerStateService.reincarnation$.subscribe((data) => {
			this.playReincarnationOverlay(data.newPlayerStateIdx);
		});

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

			// Initialize socket in service
			if (this.sessionId && this.gameStateId && this.avatarIdx != undefined && this.playerStateIdx != undefined) {
				//first get state , prepare sockets
				this.playerStateService.loadPlayerState(
					this.sessionId,
					this.gameStateId,
					this.avatarIdx,
					this.playerStateIdx
				);
				// then get avatar and connect to sockets — an assist session connects
				// with a non-colliding identity so it never kicks the player's device.
				this.avatarService.loadAvatar(this.sessionId, this.avatarIdx, true, this.assistMode).subscribe();
			}
		});
	}

	/** Player taps "retake play" on the take-over overlay to reclaim their Seat. */
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
				// Auto-bank: seed the persistent rate chip for the debt game.
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
		this.playerStateService.produce($event.letter, $event.weight);
	}

	buildSquare(recipe: Recipe) {
		this.produceLevelUp({ letter: recipe.letter, weight: recipe.weight });
	}

	getSquareIcon(key: string) {
		return this.themesService.getIcon(key);
	}

	getSquareBuildText(weight: number) {
		switch (weight) {
			case 0:
				return 'CARD.BUILD_UP_0';
			case 1:
				return 'CARD.BUILD_UP_1';
			case 2:
				return 'CARD.BUILD_UP_2';
		}
		return 'CARD.BUILD_UP';
	}

	trackByRecipe(index: number, recipe: Recipe): string {
		return recipe.letter + recipe.weight;
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
			return; // Prevent double-clicks
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

	/** Auto-bank self-service: borrow the shown terms (contract; ×2 already doubled by the caller). */
	requestCredit(amount: number, interest: number) {
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

	/** Auto-bank opening ceremony: answer the First Credit Question. */
	answerFirstCredit(answer: string) {
		this.playerStateService.answerFirstCreditQuestion(answer);
	}

	/**
	 * Full-screen skull→sprout transition, then auto-navigate to the reborn life.
	 * The overlay covers the brief DEAD flash so the player only sees "you died → new life begins".
	 */
	private async playReincarnationOverlay(newPlayerStateIdx: number) {
		if (this.isReincarnating) return;
		this.audioService.playSound('dead');
		this.isReincarnating = true;
		this.reincarnatePhase = 'death';

		// Cross-fade to the rebirth glyph partway through.
		await setTimeout(() => {
			this.reincarnatePhase = 'rebirth';
			this.audioService.playSound('angel');
			setTimeout(() => {
				this.router
					.navigate(['/player', this.sessionId, this.avatarIdx, this.gameStateId, newPlayerStateIdx])
					.finally(() => {
						// New life is loading via route params; drop the overlay on the next beat.
						setTimeout(() => (this.isReincarnating = false), 300);
					});
			}, this.REINCARNATE_OVERLAY_MS);
		}, this.REINCARNATE_OVERLAY_MS);
	}

	/**
	 * Manual fallback if the REINCARNATED socket was missed (reconnect / offline at death):
	 * resolve this avatar's current ALIVE life and jump to it.
	 */
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
			if (code) {
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
			if (this.panelCreditOpenState) this.playerStateService.refreshRate();
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

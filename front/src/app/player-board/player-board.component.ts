import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {map, Subscription, withLatestFrom} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {PlayerState, GameState, Card, Credit} from "../models/gameState";
import {MatDialog} from "@angular/material/dialog";
import {I18nService} from "../services/i18n.service";
import * as _ from 'lodash-es';
import {
	faClipboardCheck,
	faFileContract,
	faCreditCardAlt
} from "@fortawesome/free-solid-svg-icons";
import {SnackbarService} from "../services/snackbar.service";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {CongratsDialogComponent} from "../dialogs/congrats-dialog/congrats-dialog.component";
import {ScannerQrCode} from "../dialogs/scanner-qr-code/scanner-qr-code.component";
import { CREDIT_STATUS, GAME_STATUS, GAME_TYPE, IO, PLAYER_STATUS } from '@geco/shared';
import {ShortCode} from "../models/shortCode";
import {Recipe, Ingredient, getAvailableRecipes} from "../models/recipe";
import {ShortcodeDialogComponent} from "../dialogs/shortcode-dialog/shortcode-dialog.component";
import {GameInfosDialog} from "../components/notice-btn/notice-btn.component";
import createCountdown from "../services/countDown";
import {LocalStorageService} from "../services/local-storage/local-storage.service";
import {AudioService} from '../services/audio.service';
import {animations} from "../services/animations";
import {ThemesService} from '../services/themes.service';
import {getBackgroundStyle} from "../services/avatarTools";
import {AvatarService} from "../services/api/avatar.service";
import {PlayerStateService} from "../services/api/playerState.service";
import { DeckService } from '../services/api/deck.service';
import {WebSocketService} from "../services/web-socket.service";

@Component({
	selector: 'app-player-board',
	templateUrl: './player-board.component.html',
	animations,
	styleUrls: ['./player-board.component.scss']
})
export class PlayerBoardComponent implements OnInit, OnDestroy {

    protected readonly PLAYING = GAME_STATUS.PLAYING;
    protected readonly DEAD = PLAYER_STATUS.DEAD;
    protected readonly JUNE = GAME_TYPE.JUNE;
    protected readonly DEBT = GAME_TYPE.DEBT;
    protected readonly FINISHED = GAME_STATUS.FINISHED;
	protected readonly faFileContract = faFileContract;
	protected readonly faClipboardCheck = faClipboardCheck;
	protected readonly faCreditCardAlt = faCreditCardAlt;
	protected readonly getBackgroundStyle = getBackgroundStyle;
	private subscription: Subscription | undefined;

	screenWidth = 0;
	screenHeight = 0;

	sessionId: string | undefined;
	gameStateId: string | undefined;
	avatarIdx: number | undefined;
	playerStateIdx: number | undefined;

	typeTheme$ = this.themesService.typeTheme$;
	theme: string = this.themesService.getCurrentTheme();
    avatar$ = inject(AvatarService).avatar$;
    playerState$ = inject(PlayerStateService).playerState$;
    gameState$ = inject(PlayerStateService).gameState$;
    rules$ = inject(PlayerStateService).rules$;
    cards$ = inject(PlayerStateService).cards$;
    credits$ = inject(PlayerStateService).credits$;
    prison$ = inject(PlayerStateService).prison$;
    defaultCredit$ = inject(PlayerStateService).defaultCredit$;

    scanV3 = true;
	flipCoin = false;
	panelCreditOpenState = false;
	panelRecipeOpenState = false;
	prison = false;
	defaultCredit = false;
	prisonProgress = 0;
	minutesPrison = 5;
	secondsPrison = 0;
	shortCode: ShortCode | undefined;
	isBuying = false;
	isProducing = false;

    currentDebts = this.credits$.pipe(
        map(credits => credits
            .filter(c => c.status !== CREDIT_STATUS.DONE)
            .reduce((total, c) => total + c.amount + c.interest, 0)
        )
    );

    receipes = this.cards$.pipe(
        withLatestFrom(this.rules$),
        map(([cards, rules]) => {
            console.log(cards);
            return getAvailableRecipes(cards, rules.amountCardsForProd, rules.generatedIdenticalLetters);
        })
    );

    legacyCards = this.cards$.pipe(
        map(cards => {
            if(this.theme !== 'CARD') {
                return [];
            }
            cards = _.orderBy(cards, ['weight', 'letter']);
            const countByResult = _.countBy(cards, (obj: any) => `${obj.weight}-${obj.letter}`);
            const keyDuplicates: string[] = [];
            for (const c of cards) {
                const countKey = `${c.weight}-${c.letter}`;
                c.count = countByResult[countKey] || 0;
                const existCountKey = _.find(keyDuplicates, (k: string) => k === countKey);
                if (c.count > 1 && existCountKey) {
                    c.displayed = false;
                }
                if (c.count >= 1 && !existCountKey) {
                    keyDuplicates.push(countKey);
                    c.displayed = true;
                }
            }
            cards = _.orderBy(cards, ['count'], 'desc');
            return cards;
        })
    );

	prisonTimer = createCountdown({h: 0, m: 0, s: 0}, {
		listen: ({hh, mm, ss, s, h, m}) => {
			this.minutesPrison = m;
			this.secondsPrison = s;
		},
		done: () => {
			this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.PRISON_END"));
		}
	});

	constructor(private route: ActivatedRoute,
	            public dialog: MatDialog,
	            private router: Router,
	            private localStorageService: LocalStorageService,
	            private deckService: DeckService,
	            private i18nService: I18nService,
	            private themesService: ThemesService,
	            private audioService: AudioService,
	            private snackbarService: SnackbarService,
	            private avatarService: AvatarService,
	            private playerStateService: PlayerStateService,
	            private wsService: WebSocketService) {
		this.i18nService.loadNamespace('player');
	}

	updateScreenSize() {
		// Listen for window resize events to update the dimensions if the screen size changes
		this.screenWidth = window.innerWidth;
		this.screenHeight = window.innerHeight;
		window.addEventListener('resize', this.updateScreenSize.bind(this));
	}

	ngOnInit(): void {
		this.updateScreenSize();
		this.scanV3 = this.localStorageService.getItem("scanV3");
		this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = params['avatarIdx'];
			this.gameStateId = params['gameStateId'];
			this.playerStateIdx = params['playerStateIdx'];

			// Initialize socket in service
			if (this.sessionId && this.gameStateId && this.avatarIdx != undefined && this.playerStateIdx != undefined) {
                //first get state , prepare sockets
				this.playerStateService.loadPlayerState(this.sessionId, this.gameStateId, this.avatarIdx, this.playerStateIdx);
                // then get avatar and connect to sockets
                this.avatarService.loadAvatar(this.sessionId, this.avatarIdx, true).subscribe();
			}
		});
	}

	initPanels() {
		const panelC = this.localStorageService.getItem("panelCredit");
		const panelR = this.localStorageService.getItem("panelRecipe");
		this.panelCreditOpenState = panelC == undefined ? false : panelC;
		this.panelRecipeOpenState = panelR == undefined ? false : panelR;
		this.gameState$.subscribe(gameState => {
			if (gameState.typeMoney === GAME_TYPE.JUNE) {
				this.localStorageService.setItem('panelCredit', false);
				if (this.theme === "THEME.CLASSIC") {
					this.localStorageService.setItem('panelRecipe', false);
					this.panelRecipeOpenState = false;
				} else {
					this.localStorageService.setItem('panelRecipe', this.panelRecipeOpenState);
				}
			} else {
				this.localStorageService.setItem('panelCredit', this.panelCreditOpenState);
				if (this.theme === "THEME.CLASSIC") {
					this.localStorageService.setItem('panelRecipe', false);
					this.panelRecipeOpenState = false;
				} else {
					this.localStorageService.setItem('panelRecipe', this.panelRecipeOpenState);
				}
			}
		});
	}

	showGift(card: Card) {
		this.dialog.open(CongratsDialogComponent, {
			hasBackdrop: true,
			backdropClass: 'bgBlur',
			data: {
				text: card.weight > 2 ? this.i18nService.instant("EVENTS.TECHNOLOGY") : this.i18nService.instant("EVENTS.GIFT"),
				card: card,
				theme: this.theme
			},
			width: '10px',
			height: '10px'
		});
	}

	flipCoins() {
		this.flipCoin = true;
		setTimeout(() => {
			this.flipCoin = false;
		}, 2000);
	}

	//To prevent memory leak
	ngOnDestroy(): void {
        // Quitter les rooms du jeu
		if (this.gameStateId && this.avatarIdx != undefined && this.playerStateIdx != undefined) {
            this.playerStateService.leaveRooms();
		}
        if (this.subscription) this.subscription.unsubscribe();
	}

	produceLevelUp($event: any) {
		if (this.isProducing) {
			return; // Prevent double-clicks
		}
		this.isProducing = true;

		this.playerStateService.produce($event.letter, $event.weight).subscribe({
			next: (result) => {
				if (result.success) {
					if (result.data.cardGift) {
						this.showGift(result.data.cardGift);
					}
					this.audioService.playSound("cardFlipBack");
				} else {
					this.snackbarService.showError(this.i18nService.instant(result.error || "ERROR.UNKNOWN"));
					this.audioService.playSound("error");
				}
				this.isProducing = false;
			},
			error: (err) => {
				this.snackbarService.showError(this.i18nService.instant(err.error || "ERROR.UNKNOWN"));
				this.audioService.playSound("error");
				this.isProducing = false;
			}
		});
	}

	scan() {
		const dialogRef = this.dialog.open(ScannerQrCode, {});
		dialogRef.afterClosed().subscribe(dataRaw => {
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
        this.playerStateService.sendBuyingShortCode(this.gameStateId!, this.playerStateIdx!, code);
        this.snackbarService.showSuccess(this.i18nService.instant("EVENTS.SHORT_CODE_SEND"));
	}

	buy(dataRaw: any) {
		if (this.isBuying) {
			return; // Prevent double-clicks
		}
		this.isBuying = true;

		this.playerStateService.buy(dataRaw).subscribe({
			next: (result) => {
				if (result.success) {
					this.audioService.playSound("cardFlipBack");
				} else {
					this.snackbarService.showError(this.i18nService.instant(result.error || "ERROR.UNKNOWN"));
					this.audioService.playSound("error");
				}
				this.isBuying = false;
			},
			error: () => {
				this.snackbarService.showError(this.i18nService.instant("ERROR.UNKNOWN"));
				this.audioService.playSound("error");
				this.isBuying = false;
			}
		});
	}

	requestingWhenCreditEnds(credit: Credit, beep: boolean) {
		// this.playerState$!.status = "needAnswer";
		const dialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				title: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.TITLE"),
				message: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.MESSAGE", {
					amount: (credit.amount + credit.interest),
					interest: credit.interest
				}),
				labelBtn1: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.BTN1"),
				labelBtn2: this.i18nService.instant("DIALOG.CREDIT_EXPIRED.BTN2"),
				autoClickBtn2: true,
				timerBtn2: "14",//en secondes
				beep,
			}
		});
		dialogRef.afterClosed().subscribe(options => {
			if (options == "btn2") {
				this.playerStateService.payInterest(credit).subscribe({
					next: (result) => {
						if (result.success) {
							this.audioService.playSound("interest");
						} else {
							this.snackbarService.showError(this.i18nService.instant(result.error || "ERROR.UNKNOWN"));
							this.audioService.playSound("error");
						}
					},
					error: () => {
						this.snackbarService.showError(this.i18nService.instant("ERROR.UNKNOWN"));
						this.audioService.playSound("error");
					}
				});
			} else if (options == "btn1") {
				this.settleCredit(credit);
			}
		});
	}

	settleDebt(credit: Credit) {
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				message: this.i18nService.instant("CREDIT.SETTLE_CREDIT", {amount: credit.amount + credit.interest}),
				labelBtn1: this.i18nService.instant("CREDIT.SETTLE_ALL"),
				labelBtn2: this.i18nService.instant("DIALOG.CANCEL"),
			}
		});
		confDialogRef.afterClosed().subscribe(result => {
			if (result && result == "btn1") {
				this.settleCredit(credit);
			}
		});
	}

	settleCredit(credit: Credit) {
		this.playerStateService.settleCredit(credit).subscribe({
			next: (result) => {
				if (result.success) {
					this.snackbarService.showSuccess(this.i18nService.instant("CREDIT.CREDIT_SETTLED"));
					this.audioService.playSound("interest");
				} else {
					this.snackbarService.showError(this.i18nService.instant(result.error || "ERROR.UNKNOWN"));
					this.audioService.playSound("error");
				}
			},
			error: (err) => {
				this.snackbarService.showError(this.i18nService.instant(err.error || "ERROR.UNKNOWN"));
				this.audioService.playSound("error");
			}
		});
	}

	creditActionBtn($event: string, credit: Credit) {
		this.gameState$.pipe(
			withLatestFrom(this.playerState$),
			map(([gameState, playerState]) => {
				if (gameState.status == GAME_STATUS.PLAYING && playerState.status != PLAYER_STATUS.DEAD) {
					if ($event == 'settle') {
						this.settleDebt(credit);
					} else if ($event == 'answer') {
						this.requestingWhenCreditEnds(credit, false);
					}
				}
			})
		).subscribe();
	}

	tryReincarnate() {
		// TODO: Implement reincarnation flow
	}

	onCreateShortCode($event: ShortCode) {
		this.shortCode = $event;
	}

	openDialogShorCode() {
		const shortCodeDialogRef = this.dialog.open(ShortcodeDialogComponent);
		shortCodeDialogRef.afterClosed().subscribe(code => {
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
		} else if (panel == 'recipe') {
			this.panelRecipeOpenState = !this.panelRecipeOpenState;
			this.localStorageService.setItem('panelRecipe', this.panelRecipeOpenState);
		}
	}

	onRecipeCompleted(recipe: Recipe) {
		console.log(recipe);
	}

	whoHaveCard(ingredient: Ingredient) {
		const cardName = this.themesService.getIcon(ingredient.key) + " " + this.i18nService.instant(ingredient.key);
		this.deckService.whoHaveCard(this.gameStateId, ingredient.key).subscribe((payload: any) => {
			this.dialog.open(InformationDialogComponent, {
				data: {
					text: payload.status == "deck" ? this.i18nService.instant("CARD.IN_DECK", {cardName}) : this.i18nService.instant("CARD.IN_PLAYER", {
						player: payload.name,
						cardName
					}),
				}
			});
		});
	}

	recipeCompleted(recipe: Recipe) {
		if (recipe.completed && recipe.ingredients.some(i => i.have > 0)) {
			this.produceLevelUp({letter: recipe.letter, weight: recipe.weight});
		}
	}

}

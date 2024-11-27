import {AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {BackService} from "../services/back.service";
import {Game, Player} from "../models/game";
import {environment} from "../../environments/environment";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {
	faFlagCheckered, faQrcode, faCogs, faTrashCan,
	faCircleInfo, faWarning, faBuildingColumns, faKeyboard
} from '@fortawesome/free-solid-svg-icons';
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {SnackbarService} from "../services/snackbar.service";
import createCountdown from "../services/countDown";
// @ts-ignore
import * as C from "../../../../config/constantes";
import * as _ from 'lodash-es';
import {GameOptionsDialogComponent} from "../dialogs/game-options-dialog/game-options-dialog.component";
import {SessionStorageService} from "../services/local-storage/session-storage.service";
import {StorageKey} from "../services/local-storage/storage-key.const";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {WebSocketService} from "../services/web-socket.service";

@Component({
	selector: 'app-master-board',
	templateUrl: './master-board.component.html',
	styleUrls: ['./master-board.component.scss']
})
export class MasterBoardComponent implements OnInit, AfterViewInit, OnDestroy {
	private subscription: Subscription | undefined;
	@ViewChild('videoPlayerL') videoPlayerL!: ElementRef;
	@ViewChild('videoPlayerLT') videoPlayerLT!: ElementRef;
	@ViewChild('videoPlayerR') videoPlayerR!: ElementRef;
	@ViewChild('videoPlayerRT') videoPlayerRT!: ElementRef;
	idGame = "";
	public game: Game = new Game;
	data = "";
	private socket: any;
	deleteUser = false;
	killUser = false;
	protected readonly environment = environment;
	faTrashCan = faTrashCan;
	faFlagCheckered = faFlagCheckered;
	faQrcode = faQrcode;
	faCogs = faCogs;
	faInfo = faCircleInfo;
	faWarning = faWarning;
	faBuildingColumns = faBuildingColumns;
	audioStart = new Audio();

	C = C;
	timerProgress = 100;

	options = [
		{value: C.JUNE, label: "MONEY_FREE", isDisabled: false},
		{value: C.DEBT, label: "MONEY_DEBT", isDisabled: false},
	];
	minutes = "00";
	seconds = "00";
	timer = createCountdown({h: 0, m: 0, s: 0}, {
		listen: ({hh, mm, ss, s, h, m}) => {
			this.minutes = mm;
			this.seconds = ss;
			const secondsRemaining = s + (m * 60);
			this.sessionStorageService.setItem(StorageKey.timerRemaining, secondsRemaining);
			this.timerProgress = secondsRemaining / (this.game.roundMinutes * 60) * 100;
		},
		done: () => {
			this.snackbarService.showSuccess("Tour terminé");
		}
	});

	constructor(private route: ActivatedRoute,
							private sessionStorageService: SessionStorageService,
							private backService: BackService,
							private snackbarService: SnackbarService,
							private router: Router,
							private sanitizer: DomSanitizer,
							private wsService: WebSocketService,
							public dialog: MatDialog) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			if (this.route.snapshot.routeConfig?.path === 'game/:idGame/reset') {
				this.resetGameFromUrl();
			}
			this.socket = this.socket = this.wsService.getSocket(this.idGame, this.idGame + "master");
		});
		this.backService.getGame(this.idGame).subscribe(game => {
			this.game = game;
			this.minutes = this.game.roundMinutes > 9 ? this.game.roundMinutes.toString() : "0" + this.game.roundMinutes.toString();
			const timerRemaining = this.sessionStorageService.getItem(StorageKey.timerRemaining);

			if (timerRemaining && game.status == C.PLAYING) {
				this.timer.set({h: 0, m: 0, s: timerRemaining});
				this.timer.start();
			} else {
				this.timer.set({h: 0, m: this.game.roundMinutes, s: 0});
			}
			this.data = environment.WEB_HOST + environment.GAME.GET + this.idGame + '/join';
		});
	}

	ngAfterViewInit(): void {
		this.socket.on(C.UPDATED_PLAYER, (player: Player) => {
			this.game.players = _.map(this.game.players, p => {
				if (p._id == player._id) {
					p = player;
				}
				return p;
			});
		});
		this.socket.on(C.NEW_PLAYER, (player: Player) => {
			this.game.players.push(player);
		});
		this.socket.on("connected", (player: any) => {
			console.log("connected", player);
		});
		this.socket.on(C.TIMER_LEFT, (minutesRemaining: number) => {
			this.startVideos();
			this.sessionStorageService.setItem(StorageKey.timerRemaining, minutesRemaining * 60);
			if (minutesRemaining && this.game.status == C.PLAYING) {
				this.timer.stop();
				this.timer.reset();
				this.timer.set({h: 0, m: minutesRemaining, s: 0});
				this.timer.start();
			}
		});
		this.socket.on(C.STOP_ROUND, async () => {
			this.stopRound();
		});
		this.socket.on(C.DEATH_IS_COMING, async () => {
			if(this.game.autoDeath){
				this.snackbarService.showSuccess("La mort viens de passer 😈")
			}else {
			this.dialog.open(InformationDialogComponent, {
				data: {
					text: "La mort dois passé 😈! (à vous de jouer)",
					sound: "./assets/audios/iamdeath.mp3"
				},
			});
			}
		});
		this.socket.on(C.DEAD, async (event:any) => {
			_.forEach(this.game.players, p => {if(p._id==event.receiver){
				p.status = C.DEAD;
			}});
		});
	}

	startVideos() {
		this.videoPlayerL.nativeElement.play();
		this.videoPlayerLT.nativeElement.play();
		this.videoPlayerR.nativeElement.play();
		this.videoPlayerRT.nativeElement.play();
	}


	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription)
			this.subscription.unsubscribe()
	}

	getSanitizedSvgFromString(svgString: string): SafeHtml {
		return this.sanitizer.bypassSecurityTrustHtml(svgString);
	}

	onDeleteUser(player: Player) {
		this.backService.deleteUser(player._id, this.idGame).subscribe((game: Game) => {
			this.game = game;
		});
	}

	startGame() {
		if (this.game) {
			this.backService.startGame(this.game).subscribe((data: any) => {
				if (data.status == C.START_GAME) {
					this.game.status = data.status;
					this.game.round += 1;
				}
			});
		}
	}

	startRound() {
		this.backService.startRound(this.idGame, this.game.round).subscribe(() => {
			this.timer.set({h: 0, m: this.game.roundMinutes, s: 0});
			this.timer.start();
			this.game.status = C.PLAYING;
			this.audioStart.src = "./../../assets/audios/start.mp3";
			this.audioStart.load();
			this.audioStart.play();

			this.snackbarService.showSuccess("le tour " + this.game.round + " commence");
		});
	}

	stopRound() {
		this.timer.stop();
		this.timer.reset();
		this.timer.set({h: 0, m: 0, s: 0});
		this.game.status = C.STOP_ROUND;
		this.timerProgress = 0;
		this.sessionStorageService.removeItem(StorageKey.timerRemaining);
		this.snackbarService.showNotif("Tour terminé !");
		this.dialog.open(InformationDialogComponent, {
			data: {text: "Tour terminé !", sound: "../assets/audios/end.mp3"},
		});
	}

	stopRoundForce() {
		const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
			data: {
				message: "Le tour n'est pas terminé, es-tu certain de mettre fin au tour?",
				labelBtn1: "Annuler",
				labelBtn2: "OUI",
			}
		});
		confDialogRef.afterClosed().subscribe(result => {
			if (result && result == "btn2") {
				this.backService.stopRound(this.idGame, this.game.round).subscribe();
			}
		});
	}

	doIntertour() {
		this.timer.reset();
		this.timer.set({h: 0, m: this.game.roundMinutes, s: 0});
		this.backService.interRound(this.idGame).subscribe((data) => {
			if (data.status == C.INTER_ROUND) {
				this.game.status = data.status;
				this.game.round += 1;
			}
		});
	}

	resetGameFromBtn() {
		this.backService.resetGame(this.idGame).subscribe(() => {
			this.snackbarService.showSuccess("RESET GAME");
			window.location.reload();
		});
	}

	resetGameFromUrl() {
		this.backService.resetGame(this.idGame).subscribe(() => {
			this.snackbarService.showSuccess("RESET GAME");
			this.router.navigate(['game', this.idGame, 'master']);
		});
	}

	finishGame() {
		this.backService.endGame(this.idGame).subscribe(() => {
			this.snackbarService.showSuccess("Jeu terminé !");
			this.goToResults();
		});
	}

	goToResults() {
		this.router.navigate(['game', this.idGame, 'results']);
	}

	getUserUrl(idPlayer: string) {
		return environment.WEB_HOST + environment.GAME.GET + this.idGame + '/' + environment.PLAYER.GET + idPlayer;
	}

	reJoin(idPlayer: string): void {
		const dialogRef = this.dialog.open(JoinQrDialog, {
			data: {url: this.getUserUrl(idPlayer)},
		});
		dialogRef.afterClosed().subscribe(() => {
		});
	}

	qrCodeBank(): void {
		const dialogRef = this.dialog.open(JoinQrDialog, {
			data: {url: environment.WEB_HOST + environment.GAME.GET + this.idGame + '/bank'},
		});
		dialogRef.afterClosed().subscribe(() => {
		});
	}

	showEvents() {
		window.open('game/' + this.idGame + '/results', '_blank');
	}

	showBank() {
		window.open('game/' + this.idGame + '/bank', '_blank');
	}

	showOptions() {
		const dialogRef = this.dialog.open(GameOptionsDialogComponent, {
			data: {game: _.clone(this.game)},
		});
		dialogRef.afterClosed().subscribe(results => {
			if (results === "reset") {
				this.resetGameFromBtn();
			} else if (results === "cancel") {
			} else {
				this.backService.updateGame(this.idGame, results).subscribe(() => {
					this.snackbarService.showSuccess("Option sauvegardé !");
				});
				this.minutes = results.roundMinutes > 9 ? results.roundMinutes.toString() : "0" + results.roundMinutes.toString();
				this.game = {...results};
			}
		});
	}

	onKillUser(player: Player) {
		this.backService.killUser(player._id, this.idGame).subscribe(() => {
			player.status = C.DEAD;
		});
	}

	onMoneyChange(event: any) {
		if (event.value === C.DEBT) {
			this.game.priceWeight1 = 1
			this.game.priceWeight2 = 2
			this.game.priceWeight3 = 4
			this.game.priceWeight4 = 8
		} else {
			this.game.priceWeight1 = 3
			this.game.priceWeight2 = 6
			this.game.priceWeight3 = 9
			this.game.priceWeight4 = 12
		}
		this.backService.updateGame(this.idGame, this.game).subscribe(() => {
			this.snackbarService.showSuccess("Option sauvegardé !");
		});
	}
}

@Component({
	selector: 'join-qr-dialog',
	templateUrl: '../dialogs/join-qr-dialog.html',
})
export class JoinQrDialog {
	constructor(public dialogRef: MatDialogRef<JoinQrDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {
	}

	back(): void {
		this.dialogRef.close();
	}
}

@Component({
	selector: 'game-infos-dialog',
	templateUrl: '../dialogs/game-infos-dialog.html',
})
export class GameInfosDialog {
	constructor(public dialogRef: MatDialogRef<GameInfosDialog>) {
	}
	faQrcode = faQrcode;
	faKeyboard = faKeyboard;
}

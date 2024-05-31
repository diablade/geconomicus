import {AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {BackService} from "../services/back.service";
import {Game, Player} from "../models/game";
import {environment} from "../../environments/environment";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {
	faFlagCheckered, faPeopleArrows, faQrcode, faCogs, faTrashCan,
	faCircleInfo, faWarning, faBuildingColumns
} from '@fortawesome/free-solid-svg-icons';
import io from "socket.io-client";
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

@Component({
	selector: 'app-master-board',
	templateUrl: './master-board.component.html',
	styleUrls: ['./master-board.component.scss']
})
export class MasterBoardComponent implements OnInit, AfterViewInit, OnDestroy {
	private subscription: Subscription | undefined;
	@ViewChild('videoPlayerL') videoPlayerL!: ElementRef;
	@ViewChild('videoPlayerR') videoPlayerR!: ElementRef;
	idGame = "";
	public game: Game = new Game;
	data = "";
	private socket: any;
	deleteUser = false;
	killUser = false;
	protected readonly environment = environment;
	ioURl: string = environment.API_HOST;
	faTrashCan = faTrashCan;
	faFlagCheckered = faFlagCheckered;
	faPeopleArrows = faPeopleArrows;
	faQrcode = faQrcode;
	faCogs = faCogs;
	faInfo = faCircleInfo;
	faWarning = faWarning;
	faBuildingColumns = faBuildingColumns;
	audioStart = new Audio();

	C = C;
	timerProgress = 100;

	options = [
		{value: C.JUNE, label: 'Monnaie libre', isDisabled: false},
		{value: C.DEBT, label: 'Monnaie dette', isDisabled: false},
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
			// this.stopRound();
			this.snackbarService.showSuccess("Tour terminé");
		}
	});

	constructor(private route: ActivatedRoute,
							private sessionStorageService: SessionStorageService,
							private backService: BackService,
							private snackbarService: SnackbarService,
							private router: Router,
							private sanitizer: DomSanitizer,
							public dialog: MatDialog) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.socket = io(this.ioURl, {
				query: {
					idPlayer: 'master',
					idGame: this.idGame,
				},
			});
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
			if (!player.image) {
				player.image = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 762 762\" fill=\"none\" shape-rendering=\"auto\"><desc>\"Adventurer\" by \"Lisa Wischofsky\", licensed under \"CC BY 4.0\". / Remix of the original. - Created with dicebear.com</desc><metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:cc=\"http://creativecommons.org/ns#\" xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"><rdf:RDF><cc:Work><dc:title>Adventurer</dc:title><dc:creator><cc:Agent rdf:about=\"https://www.instagram.com/lischi_art/\"><dc:title>Lisa Wischofsky</dc:title></cc:Agent></dc:creator><dc:source>https://www.figma.com/community/file/1184595184137881796</dc:source><cc:license rdf:resource=\"https://creativecommons.org/licenses/by/4.0/\" /></cc:Work></rdf:RDF></metadata><mask id=\"viewboxMask\"><rect width=\"762\" height=\"762\" rx=\"0\" ry=\"0\" x=\"0\" y=\"0\" fill=\"#fff\" /></mask><g mask=\"url(#viewboxMask)\"><path d=\"M396 164.8a224.8 224.8 0 0 1 104.8 42.4c6.2 4.9 12.5 9.4 18 15a225.4 225.4 0 0 1 71.8 149 58.5 58.5 0 0 1 50.9 42.2 71 71 0 0 1-27.6 76.5c-11 7.7-24.5 12-38 11.7-5 0-10-1.6-15-1.8-1.9 2.2-3.3 4.9-4.8 7.3A223.3 223.3 0 0 1 389 609.8c-11 .7-21.9 2-33 .7a223.7 223.7 0 0 1-178.8-342.3A223.4 223.4 0 0 1 352 163.5c14.6-1.4 29.4-.3 44 1.3Z\" fill=\"#000\"/><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M498.8 213.2A216 216 0 0 0 363 169c-13-.2-26.2 1.6-39 4a218 218 0 0 0-113.6 365.5 218.5 218.5 0 0 0 260.4 40.2c35-18.8 64.2-47.3 84.4-81.5l-3-1.6c-2.8-1.4-5.7-3-8-5-2.2-2-.3-5.8 2.7-4.7 1.5.7 3 1.6 4.4 2.4a55 55 0 0 0 59.6-3.6 64.5 64.5 0 0 0 25-69.8 53.1 53.1 0 0 0-24-31 52.6 52.6 0 0 0-47-2.8c-1.6.8-3.4 1.5-5 1.3-2.5-.2-2.8-4.2-.6-5.2 8-4 16.5-5.6 25.4-6.4a217 217 0 0 0-72-146.4c-4.4-4-8.7-8.1-13.9-11.3Zm107.6 196.2c2-1.2 1.3-5.1-1.4-5-2 0-4.2.8-6.2 1.6l-1.4.4a95.1 95.1 0 0 0-25.5 12.4c-2.2 2-2.2 4.4.1 6.2a92 92 0 0 0 5.2 2.8 36 36 0 0 1 13 9.2c-.2 1.9-2 3.4-3.4 4.5l-.2.2c-3.9 3-8.8 5-13.6 7-2.5 1-4.9 2-7.1 3.1-1.7.8-2.6 2.2-1.6 3.9 1 2 3.2 1.1 5 .5l.6-.2 5.4-2.3c5.4-2.3 11-4.5 15.4-8 2.7-2.1 5.1-5.1 5.4-8.7-.5-3.4-2.7-5.7-5.3-7.8a83 83 0 0 0-11.6-7.2l-1.1-.6c5.4-3 10.8-5.6 16.6-7.7l5-1.7a52 52 0 0 0 6.7-2.6Z\" fill=\"#000000\"/><g transform=\"translate(-161 -83)\"><path d=\"M559 444.5c11.4-.7 22.5 0 33.2 4.3a45.7 45.7 0 0 1 26.2 23.8c1.4 3.3 3.1 7.5 2.2 11.1-3 3.2-8.5 1-12.5 1-12.7-.6-25.5-.4-38 .6-14 1-28.5 1.7-42 5.3a188 188 0 0 0-25.2 7.4c-3.7 1.2-6.8 3-11 2.2 1.4-16.8 13-31.4 26.4-41a87.3 87.3 0 0 1 40.7-14.7Z\" fill=\"#000\"/><path d=\"M573 450.2a54 54 0 0 1 31.9 13c4.9 4.5 8.3 10.3 10.1 16.7-16.7-2.2-34.3-.9-51 0-7.7 1-15.4 1-23 2.3 1.2-9.2 2.2-18.4 1-27.7 10-3.6 20.3-5.5 31-4.3Z\" fill=\"#fff\"/><path d=\"M369.2 468.7a79.8 79.8 0 0 1 50.9 8.2c8.7 4.8 16.9 12 20.6 21.5.7 2 1.6 4.5-.7 6-2.7 0-5.4-.7-8-1.1-9.4-1.8-19.4-2.1-29-2.6-10.7-.4-21.3.5-32 .6-12.5.9-24.8 3-37 5-2.5.6-3.2-2.4-3.2-4.2.2-12.4 9.1-22.3 19.8-27.5 6-2.5 12.2-4.6 18.6-6Z\" fill=\"#000\"/><path d=\"M516.9 467.3c-.6 7-.6 13.5 0 20.4a278 278 0 0 0-18.1 6.1 58 58 0 0 1 18-26.5ZM374.6 473.4c9.9-.6 19.7 0 29.2 2.9a50.8 50.8 0 0 1 30.6 21.5c-20.2-3.5-40-2.6-60.3-2.4.8-7.4.6-14.7.5-22ZM350.5 480.6c-.3 5.8-.3 11.6 0 17.5-4.7.3-9.4.7-14 1.7 1.6-7 5.1-12.1 10.6-16.6l3.4-2.6Z\" fill=\"#fff\"/></g><g transform=\"translate(-161 -83)\"><path d=\"M397 373.1c6.9.2 14.2 2.9 18 9 1 1.4.6 3.6.7 5.3-6.3.2-12.5.4-18.6 1.9a112 112 0 0 0-41.7 20.1 90 90 0 0 0-22 23c-1.3 2.3-2.3 5.1-4.2 7-1.2.2-2.6.2-3.8.3 0-1.8-.3-3.4.2-5.2a88.7 88.7 0 0 1 38-50.8c10-5.8 21.8-11 33.5-10.6ZM578.5 411.7a71.4 71.4 0 0 1 30 10l-.2 4.7c-4 1.6-7.3-.1-11.3-.8-6.8-1.2-13.9-1.2-20.8-1a197.5 197.5 0 0 0-84 23.7c-1.4.6-3 1-4.4 1.5-2.6-5.4-3.6-11-.1-16.2 5-7.6 15.2-12.4 23.6-15.4 21.3-7.4 44.9-9 67.2-6.5Z\" fill=\"#000\"/></g><g transform=\"translate(-161 -83)\"><path d=\"M517.9 557.8c1.5.3 2.8 1.6 2.7 3.2-7 16.8-15 33.2-25.1 48.4-4.7 7-9.2 14.2-14.5 20.6-2.1 3.3-8 3-10.8.8-6.9-5-13.3-10.7-19-16.9-9.3-10.4-18-20.1-24.8-32.4-.8-1.9-2.3-4-.8-5.9.6-1.2 3-.8 3.6.2 5.1 9.2 11.4 17.7 18.5 25.5a154 154 0 0 0 22.7 22.3c1.2.8 2.4 1.7 3.8 2 2.6.4 3.8-1.2 5.3-3.1 13.5-19 25.7-38.8 34.6-60.4.9-2 1.5-3.7 3.8-4.3Z\" fill=\"#000\"/></g><g transform=\"translate(-161 -83)\"></g><g transform=\"translate(-161 -83)\"></g><g transform=\"translate(-161 -83)\"><g fill=\"#000\"><path d=\"M546 236.8a220 220 0 0 1 141.8 52.3 189.7 189.7 0 0 1 60.4 97.9c5.5 21.9 6.6 44.4 4.3 66.8-.4 1.8-.5 5.6-3 5.6-4.2.2-8.5 0-12.7 1.2a64.9 64.9 0 0 0-31.2 17c-1 1-2 2.2-3.6 1.8-1.6 0-2.3-2-2.1-3.4.3-3 1.5-6 2.1-9 1.6-6.7 1.9-13.2 2.5-20 .6-6.8-.3-13.3-.9-20-.4-3.8-1.2-7.3-2-11a54.2 54.2 0 0 1-26.5-7c-15.8-9-27.3-25-35.5-40.8-9.8-19-16-40-20.2-60.8a441.8 441.8 0 0 1-91.2 25.9 561.7 561.7 0 0 1-101.2 9 386 386 0 0 1-71.2-6c-2-.4-3.5-1.1-3.6-3.3 1-3.8 4-7.3 6.5-10.3 9-11 19-21 29.9-30.1A242 242 0 0 1 546 236.8Z\"/><path d=\"M718.6 474.6c0 1 .3 2.7-.5 3.5-2.2 2.4-5.1 4.2-7.6 6.4-2.6 2.2-4.8 4.9-7.5 6.9-2.7.5-4-2-2.7-4.1 2.7-3.8 6.7-6.8 10.2-9.8 2.7-2 4.5-4.7 8-3Z\"/></g><path d=\"M520.2 243.8c41.3-4.2 83.5 2.8 120.8 21.2a194.1 194.1 0 0 1 79.2 70.7 181 181 0 0 1 26.4 118 68 68 0 0 0-38.6 14c2.8-16.5 3.5-33.4 0-49.8-.7-2.4-1.2-5.3-2.8-7.1-1.6-1.2-4.3-.8-6.2-1-8 .2-16-2.8-22.9-7a87.5 87.5 0 0 1-27.6-30.3 211 211 0 0 1-22.2-60.5c-.8-3.3-1.1-6.8-2.3-10-.9-1.4-2.4-1.8-4-1.2-3.6 1.3-7.1 3-10.7 4.3a443.8 443.8 0 0 1-82.3 22.5 588.4 588.4 0 0 1-81 8.7c-14.6.2-29.4.4-44-.4-14.3-1-28.4-2.4-42.5-4.8a232.8 232.8 0 0 1 160.7-87.3Z\" fill=\"#0e0e0e\"/></g><g transform=\"translate(-161 -83)\"></g></g></svg>";
			}
			this.game.players.push(player);
		});
		this.socket.on("connected", (players: any) => {
			console.log("connected", players);
		});
		this.socket.on('disconnect', () => {
			console.log('Socket has been disconnected');
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
	}

	startVideos() {
		this.videoPlayerL.nativeElement.play();
		this.videoPlayerR.nativeElement.play();
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
		this.dialog.open(InformationDialogComponent, {
			data: {text: "Tour terminé !"},
		});
	}

	stopRoundForce() {
		this.backService.stopRound(this.idGame, this.game.round).subscribe();
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

	resetGame() {
		this.backService.resetGame(this.idGame).subscribe(() => {
			this.snackbarService.showSuccess("RESET GAME");
			location.reload();
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
				this.resetGame();
			} else {
				this.backService.updateGame(this.idGame, results).subscribe(() => {
					this.snackbarService.showSuccess("Option sauvegardé !");
				});
				this.minutes = results.roundMinutes > 9 ? results.roundMinutes.toString() : "0" + results.roundMinutes.toString();
				this.game = {...results};
			}
		});
	}

	showRules() {
		this.dialog.open(GameInfosDialog, {});
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
}

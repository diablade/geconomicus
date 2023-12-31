import {AfterViewInit, Component, ElementRef, Inject, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {BackService} from "../services/back.service";
import {Game, Player} from "../models/game";
import {environment} from "../../environments/environment";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {
  faFlagCheckered,
  faPeopleArrows,
  faQrcode,
  faCogs,
  faTrashCan,
  faCircleInfo, faWarning,
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
export class MasterBoardComponent implements OnInit, AfterViewInit {
  private subscription: Subscription | undefined;
  @ViewChild('videoPlayerL') videoPlayerL!: ElementRef;
  @ViewChild('videoPlayerR') videoPlayerR!: ElementRef;
  idGame: string = "";
  public game: Game = new Game;
  data: string = "";
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

  C = C;
  timerProgress: number = 100;

  options = [
    {value: C.JUNE, label: 'Monnaie libre', isDisabled: false},
    {value: C.DEBT, label: 'Monnaie dette', isDisabled: false},
  ];
  minutes: string = "00";
  seconds: string = "00";
  timer = createCountdown({h: 0, m: 0, s: 0}, {
    listen: ({hh, mm, ss, s, h, m}) => {
      this.minutes = mm;
      this.seconds = ss;
      let secondsRemaining = s + (m * 60);
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
      let timerRemaining = this.sessionStorageService.getItem(StorageKey.timerRemaining);

      if (timerRemaining && game.status == C.START_ROUND) {
        this.timer.set({h: 0, m: 0, s: timerRemaining});
        this.timer.start();
      } else {
        this.timer.set({h: 0, m: this.game.roundMinutes, s: 0});
      }
      this.data = environment.WEB_HOST + environment.GAME.GET + this.idGame + '/join';
    });
  }

  ngAfterViewInit(): void {
    this.socket.on("updated-game", (game: any) => {
      this.game = game;
    });
    this.socket.on("connected", (players: any) => {
      console.log("connected", players);
    });
    this.socket.on('disconnect', () => {
      console.log('Socket has been disconnected');
    });
    this.socket.on(C.TIMER_LEFT, (minutesRemaining: number) => {
      console.log("timer left ", minutesRemaining);
      this.startVideos();
      this.sessionStorageService.setItem(StorageKey.timerRemaining, minutesRemaining * 60);
      if (minutesRemaining && this.game.status == C.START_ROUND) {
        this.timer.stop();
        this.timer.reset();
        this.timer.set({h: 0, m: minutesRemaining, s: 0});
        this.timer.start();
      }
    });
    this.socket.on(C.STOP_ROUND, async (data: any) => {
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
      this.game.status = C.START_ROUND;
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
    const dialogRef = this.dialog.open(InformationDialogComponent, {
      data: {text: "Tour terminé !"},
    });
  }

  stopRoundForce() {
    this.backService.stopRound(this.idGame, this.game.round).subscribe(() => {
    });
  }

  doIntertour() {
    this.timer.reset();
    this.timer.set({h: 0, m: this.game.roundMinutes, s: 0});
    this.backService.interRound(this.idGame).subscribe((data) => {
      console.log(data);
      if (data.status == C.INTER_ROUND) {
        this.game.status = data.status;
        this.game.round += 1;
      }
    });
  }

  resetGame() {
    this.backService.resetGame(this.idGame).subscribe((data: any) => {
      this.snackbarService.showSuccess("RESET GAME");
      location.reload();
    });
  }

  finishGame() {
    this.backService.endGame(this.idGame).subscribe((data: any) => {
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
    dialogRef.afterClosed().subscribe(result => {
    });
  }

  showEvents() {
    window.open('game/' + this.idGame + '/results', '_blank');
  }

  showOptions() {
    const dialogRef = this.dialog.open(GameOptionsDialogComponent, {
      data: {game: _.clone(this.game)},
    });
    dialogRef.afterClosed().subscribe(results => {
      if (results === "reset") {
        this.resetGame();
      } else {
        this.backService.updateGame(this.idGame, results).subscribe((data: any) => {
          this.snackbarService.showSuccess("Option sauvegardé !");
        });
        this.minutes = results.roundMinutes > 9 ? results.roundMinutes.toString() : "0" + results.roundMinutes.toString();
        this.game.name = results.name;
        this.game.priceWeight1 = results.priceWeight1;
        this.game.priceWeight2 = results.priceWeight2;
        this.game.priceWeight3 = results.priceWeight3;
        this.game.priceWeight4 = results.priceWeight4;
        this.game.roundMax = results.roundMax;
        this.game.roundMinutes = results.roundMinutes;
        this.game.surveyEnabled = results.surveyEnabled;
        this.game.amountCardsForProd = results.amountCardsForProd;
        this.game.generatedIdenticalCards = results.generatedIdenticalCards;

        //option june
        this.game.inequalityStart = results.inequalityStart;
        this.game.startAmountCoins = results.startAmountCoins;
        this.game.tauxCroissance = results.tauxCroissance;
        this.game.pctRich = results.pctRich;
        this.game.pctPoor = results.pctPoor;

        //option debt
        this.game.defaultCreditAmount = results.defaultCreditAmount;
        this.game.defaultInterestAmount = results.defaultInterestAmount;
        this.game.timerInterestPayment = results.timerInterestPayment;
        this.game.timerPrison = results.timerPrison;
        this.game.manualBank = results.manualBank;
        this.game.seizureType = results.seizureType;
        this.game.seizureCosts = results.seizureCosts;
        this.game.seizureDecote = results.seizureDecote;
      }
    });
  }

  showRules() {
    this.dialog.open(GameInfosDialog, {});
  }

  onKillUser(player: Player) {
    this.backService.killUser(player._id, this.idGame).subscribe((data) => {
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
    this.backService.updateGame(this.idGame, this.game).subscribe((data: any) => {
      this.snackbarService.showSuccess("Option sauvegardé !");
    });
  }

  saveCreditValues() {

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

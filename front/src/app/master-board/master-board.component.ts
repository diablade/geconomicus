import {AfterViewInit, Component, Inject, OnInit} from '@angular/core';
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
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import io from "socket.io-client";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {SnackbarService} from "../services/snackbar.service";
import {LocalStorageService} from "../services/local-storage/local-storage.service";
import createCountdown from "../services/countDown";
// @ts-ignore
import * as C from "../../../../config/constantes";
import {GameOptionsDialogComponent} from "../dialogs/game-options-dialog/game-options-dialog.component";

@Component({
  selector: 'app-master-board',
  templateUrl: './master-board.component.html',
  styleUrls: ['./master-board.component.scss']
})
export class MasterBoardComponent implements OnInit, AfterViewInit {
  private subscription: Subscription | undefined;
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

  timerProgress: number = 0;

  options = [
    {value: 'june', label: 'Monnaie libre', isDisabled: false},
    {value: 'Debt', label: 'Monnaie dette (coming soon)', isDisabled: true},
  ];
  minutes: string = "00";
  seconds: string = "00";
  timer = createCountdown({h: 0, m: 0, s: 0}, {
    listen: ({hh, mm, ss, s, h, m}) => {
      console.log(`${hh}:${mm}:${ss}`);
      this.minutes = mm;
      this.seconds = ss;
      let secondsRemaining = s + (m * 60);
      this.localStorageService.setTimerRemaining(secondsRemaining);
      this.timerProgress = secondsRemaining / (this.game.roundMinutes * 60) * 100;
    },
    done: () => {
      this.stopRound();
    }
  });

  constructor(private route: ActivatedRoute,
              private localStorageService: LocalStorageService,
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
      let timerRemaining = this.localStorageService.getTimerRemaining();
      if (timerRemaining && game.status == "playing") {
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
    this.socket.on(C.START_ROUND, (data: any) => {
    });
    this.socket.on(C.STOP_ROUND, (data: any) => {
    });
    this.socket.on('disconnect', () => {
      console.log('Socket has been disconnected');
    });
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
        if (data.status == C.STARTED) {
          this.game.status = data.status;
          this.game.round += 1;
        }
      });
    }
  }

  startRound() {
    this.backService.startRound(this.idGame).subscribe(() => {
      this.timer.start();
      this.game.status = 'playing';
      this.snackbarService.showSuccess("le tour " + this.game.round + " commence");
    });
  }

  stopRound() {
    this.timer.stop();
    this.game.status = 'intertour';
    this.timerProgress = 100;
    this.localStorageService.removeRemaining();
    this.backService.stopRound(this.idGame).subscribe(() => {
      this.snackbarService.showSuccess("le tour " + this.game.round + " à terminé");
    });
  }

  doIntertour() {
    this.timer.reset();
    this.timer.set({h: 0, m: this.game.roundMinutes, s: 0});
    this.backService.interRound(this.idGame).subscribe((data) => {
      console.log(data);
      if (data.status == 'intertourDone') {
        this.game.status = data.status;
        this.game.round += 1;
        this.snackbarService.showSuccess("Dividendes Universels distribués");
      }
    });
  }

  resetGame() {
    this.backService.resetGame(this.idGame).subscribe((data: any) => {
      this.snackbarService.showSuccess("RESET GAME");
    });
  }

  finishGame() {
    this.backService.stopGame(this.idGame).subscribe((data: any) => {
      this.snackbarService.showSuccess("Jeu terminé !");
      this.router.navigate(['results', this.idGame]);
    });
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
    window.open('game/' + this.idGame + '/events', '_blank');
  }

  showOptions() {
    const dialogRef = this.dialog.open(GameOptionsDialogComponent, {
      data: {game: this.game},
    });
    dialogRef.afterClosed().subscribe(results => {
      this.game.roundMax = results.roundMax;
      this.game.roundMinutes = results.roundMinutes;
      this.game.priceWeight1 = results.priceWeight1;
      this.game.priceWeight2 = results.priceWeight2;
      this.game.priceWeight3 = results.priceWeight3;
      this.game.priceWeight4 = results.priceWeight4;
      this.game.inequalityStart = results.inequalityStart;
      this.game.startAmountCoins = results.startAmountCoins;
      this.game.tauxCroissance = results.tauxCroissance;
      this.game.name = results.name;
    });
  }

  showRules() {
    this.dialog.open(GameInfosDialog, {});
  }

  onKillUser(player: Player) {
    this.backService.killUser(player._id, this.idGame).subscribe((data) => {
      player.status=C.DEAD;
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

import {AfterViewInit, Component, Inject, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {BackService} from "../services/back.service";
import {Game, Player} from "../models/game";
import {environment} from "../../environments/environment";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import {faFlagCheckered, faQrcode, faTrashCan} from '@fortawesome/free-solid-svg-icons';
import io from "socket.io-client";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {SnackbarService} from "../services/snackbar.service";
import {LocalStorageService} from "../services/local-storage/local-storage.service";
import createCountdown from "../services/countDown";

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
  selectedMoney: any;
  private socket: any;
  deleteUser = false;
  protected readonly environment = environment;
  ioURl: string = environment.API_HOST;
  faTrashCan = faTrashCan;
  faFlagCheckered = faFlagCheckered;
  faQrcode = faQrcode;
  timerProgress: number = 0;

  options = [
    {value: 'moneyLibre', label: 'Monnaie libre'},
    {value: 'moneyDette', label: 'Monnaie dette'},
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
    this.socket.on("start-round", (data: any) => {
    });
    this.socket.on("stop-round", (data: any) => {
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
        if (data.status == "started") {
          this.game.status = data.status;
          this.game.round += 1;
        }
      });
    }
  }

  startRound() {
    this.backService.startRound(this.idGame).subscribe(() => {
      this.timer.start();
      console.log("started");
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
}

@Component({
  selector: 'join-qr-dialog',
  templateUrl: 'join-qr-dialog.html',
})
export class JoinQrDialog {
  constructor(public dialogRef: MatDialogRef<JoinQrDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {
  }

  back(): void {
    this.dialogRef.close();
  }
}

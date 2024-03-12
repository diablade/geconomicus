import {Component} from '@angular/core';
import {Subscription} from "rxjs";
import {Credit, Game} from "../models/game";
import {ActivatedRoute} from "@angular/router";
import {SessionStorageService} from "../services/local-storage/session-storage.service";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {MatDialog} from "@angular/material/dialog";
// import io from "socket.io-client";
// @ts-ignore
import * as C from "../../../../config/constantes";
import * as _ from 'lodash-es';
import {faCircleInfo, faSackDollar, faLandmark} from "@fortawesome/free-solid-svg-icons";
import {ContractDialogComponent} from "../dialogs/contract-dialog/contract-dialog.component";

@Component({
  selector: 'app-bank-board',
  templateUrl: './bank-board.component.html',
  styleUrls: ['./bank-board.component.scss']
})
export class BankBoardComponent {
  faSackDollar = faSackDollar;
  faCircleInfo = faCircleInfo;
  faLandMark = faLandmark;
  subscription: Subscription | undefined;
  idGame: string = "";
  game: Game = new Game;
  data: string = "";
  socket: any;
  C = C;

  constructor(private route: ActivatedRoute,
              private sessionStorageService: SessionStorageService,
              private backService: BackService,
              private snackbarService: SnackbarService,
              public dialog: MatDialog) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      // this.socket = io(this.ioURl, {
      //   query: {
      //     idPlayer: 'master',
      //     idGame: this.idGame,
      //   },
      // });
      this.backService.getGame(this.idGame).subscribe(game => {
        this.game = game;
        console.log(game);
      });
    });
  }

  getAverageCurrency() {
    return this.game.currentMassMonetary / _.size(_.filter(this.game.players, {'status': 'alive'}));
  }
  getPlayerName(idPlayer: string) {
    const player = _.find(this.game.players, p => p._id === idPlayer);
    return player ? player.name : idPlayer;
  }

  showContract() {
    const dialogRef = this.dialog.open(ContractDialogComponent, {
      data: {game: _.clone(this.game)},
    });
    dialogRef.afterClosed().subscribe(data => {
      console.log(data);
      this.backService.createCredit({...data, idGame: this.idGame}).subscribe((data: any) => {
        this.snackbarService.showSuccess("Credit octroyer à ");

      });
    });
  }

  settlementDebt(credit: Credit) {
    // this.backService.settlement(credit).subscribe(data=>{
    //   this.snackbarService.showSuccess("credit remboursé")
    // })
  }
}

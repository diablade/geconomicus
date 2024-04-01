import {AfterViewInit, Component, OnInit} from '@angular/core';
import {Subscription} from "rxjs";
import {Credit, Game} from "../models/game";
import {ActivatedRoute} from "@angular/router";
import {SessionStorageService} from "../services/local-storage/session-storage.service";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {MatDialog} from "@angular/material/dialog";
import io from "socket.io-client";
// @ts-ignore
import * as C from "../../../../config/constantes";
import * as _ from 'lodash-es';
import {faCircleInfo, faSackDollar, faLandmark} from "@fortawesome/free-solid-svg-icons";
import {ContractDialogComponent} from "../dialogs/contract-dialog/contract-dialog.component";
import {environment} from "../../environments/environment";

@Component({
  selector: 'app-bank-board',
  templateUrl: './bank-board.component.html',
  styleUrls: ['./bank-board.component.scss']
})
export class BankBoardComponent implements OnInit, AfterViewInit {
  faSackDollar = faSackDollar;
  faCircleInfo = faCircleInfo;
  faLandMark = faLandmark;
  ioURl: string = environment.API_HOST;
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
      this.socket = io(this.ioURl, {
        query: {
          idPlayer: this.idGame + 'bank',
          idGame: this.idGame,
        },
      });
      this.backService.getGame(this.idGame).subscribe(game => {
        this.game = game;
      });
    });
  }

  ngAfterViewInit() {
    this.socket.on(C.PROGRESS_CREDIT, async (data: any) => {
      _.forEach(this.game.credits, c => {
        if (c._id == data.id) {
          c.progress = data.progress;
        }
      });
    });
    this.socket.on(C.TIMEOUT_CREDIT, async (data: any) => {
      _.forEach(this.game.credits, c => {
        if (c._id == data._id) {
          c.status = data.status;
        }
      });
    });
    this.socket.on(C.PAYED_INTEREST, async (data: any) => {
      _.forEach(this.game.credits, c => {
        if (c._id == data._id) {
          c.status = data.status;
          c.extended = data.extended;
        }
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
    dialogRef.afterClosed().subscribe(contrat => {
      this.backService.createCredit({...contrat, idGame: this.idGame}).subscribe((credit: Credit) => {
        this.snackbarService.showSuccess("Credit octroyer à " + this.getPlayerName(credit.idPlayer));
        this.game.credits.push(credit);
      });
    });
  }

  settlementDebt(credit: Credit) {
    // this.backService.settlement(credit).subscribe(data=>{
    //   this.snackbarService.showSuccess("credit remboursé")
    // })
  }

  getDebts() {
    let debt = 0;
    _.forEach(this.game.credits, c => {
      if (c.status != C.CREDIT_DONE) {
        debt += (c.amount + c.interest)
      }
    });
    return debt;
  }
}

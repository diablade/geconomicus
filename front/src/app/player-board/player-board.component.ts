import {createAvatar, Options} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import io from 'socket.io-client';
import {ActivatedRoute, Router} from "@angular/router";
import {Card, Player} from "../models/game";
import {BackService} from "../services/back.service";
import {ScannerDialogComponent} from "../dialogs/scanner-dialog/scanner-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {environment} from "../../environments/environment";
import * as _ from 'lodash-es';
import {faCamera} from "@fortawesome/free-solid-svg-icons";
import {SnackbarService} from "../services/snackbar.service";
import {animate, animateChild, query, stagger, state, style, transition, trigger} from "@angular/animations";
import {LoadingService} from "../services/loading.service";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
// @ts-ignore
import * as C from "../../../../config/constantes";
import {MatSnackBar} from "@angular/material/snack-bar";


@Component({
  selector: 'app-player-board',
  templateUrl: './player-board.component.html',
  animations: [
    // nice stagger effect when showing existing elements
    trigger('list', [
      transition(':enter', [
        // child animation selector + stagger
        query('@items',
          stagger(600, animateChild()), {optional: true}
        )
      ]),
    ]),
    trigger('items', [
      transition(':enter', [
        style({transform: 'translateY(-100rem)'}),
        animate('600ms',
          style({transform: 'translateY(0rem)'}))
      ]),
      transition(':leave', [
        style({transform: 'translateY(0rem)'}),
        animate('600ms',
          style({transform: 'translateY(-100rem)'}))
      ]),
    ]),
    trigger('duReceived', [
      state('void', style({
        opacity: 0,
        transform: 'rotate(0deg)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'rotate(360deg)'
      })),
      transition(':enter', animate('1500ms ease')),
      transition(':leave', animate('1500ms ease'))
    ])
  ],
  styleUrls: ['./player-board.component.scss']
})
export class PlayerBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('svgContainer') svgContainer!: ElementRef;
  ioURl: string = environment.API_HOST;
  private socket: any;
  screenWidth: number = 0;
  screenHeight: number = 0;
  idGame: string | undefined;
  idPlayer: string | undefined;
  player: Player = new Player();
  private subscription: Subscription | undefined;
  options: Partial<adventurer.Options & Options> = {};
  statusGame: string = "waiting";
  typeMoney: string = "june";
  currentDU: number = 0;
  cards: Card[] = [];
  faCamera = faCamera;

  constructor(private route: ActivatedRoute, public dialog: MatDialog, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService, private _snackBar: MatSnackBar) {
  }

  updateScreenSize() {
    // Listen for window resize events to update the dimensions if the screen size changes
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    window.addEventListener('resize', this.updateScreenSize.bind(this));
  }

  ngOnInit(): void {
    this.updateScreenSize();
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.idPlayer = params['idPlayer'];
      this.socket = io(this.ioURl, {
        query: {
          idPlayer: this.idPlayer,
          idGame: this.idGame,
        },
      });

      this.backService.getPlayer(this.idGame, this.idPlayer).subscribe(async data => {
        this.player = data.player;
        this.typeMoney = data.typeMoney;
        this.currentDU = data.currentDU;
        this.statusGame = data.statusGame;
        if (this.player.image === "") {
          this.options.seed = data.player.name.toString();
          const avatar = createAvatar(adventurer, this.options);
          this.player.image = avatar.toString();
        }
        // @ts-ignore
        this.svgContainer.nativeElement.innerHTML = this.player.image;
        this.receiveCards(this.player.cards);
      });
    });
  }

  ngAfterViewInit() {
    this.socket.on(C.START_GAME, async (data: any) => {
      this.statusGame = "waiting";
      this.player.coins = data.coins;
      await this.receiveCards(data.cards);
    });
    this.socket.on(C.START_ROUND, async (data: any) => {
      this.statusGame = "playing";
      const dialogRef = this.dialog.open(InformationDialogComponent, {
        data: {text: "c'est parti !! le tour à démarré "},
      });
    });
    this.socket.on(C.STOP_ROUND, async (data: any) => {
      this.statusGame = "waiting";
      const dialogRef = this.dialog.open(InformationDialogComponent, {
        data: {text: "tour terminé !"},
      });
    });
    this.socket.on("connected", (data: any) => {
      console.log("connected", data);
    });
    this.socket.on('disconnect', () => {
      console.log('Socket has been disconnected');
    });
    this.socket.on(C.STOP_GAME, (data: any) => {
      this.snackbarService.showSuccess("Jeu terminé !");
      this.router.navigate(['results', this.idGame]);
    });
    this.socket.on(C.DISTRIB_DU, (data: any) => {
      this.duVisible = true;
      this.player.coins += data.du;
      this.currentDU = data.du;
      setTimeout(() => {
        this.duVisible = false;
      }, 4000);
    });
    this.socket.on(C.RESET_GAME, async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.cards = [];
      this.player.coins = 0;
    });
    this.socket.on(C.FIRST_DU, async (data: any) => {
      this.currentDU = data.du;
    });
    this.socket.on(C.DEAD, async (data: any) => {
      this.player.status = C.DEAD;
      this.dialog.closeAll();
      const dialogRef = this.dialog.open(InformationDialogComponent, {
        data: {text: "☠️La mort vient de passer ! ☠️ \n Resurrection en cours....️"},
      });
      this.cards = [];
      if (this.typeMoney === "debt") {
        this.player.coins = 0;
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
      this.resurrection();
    });
    this.socket.on(C.TRANSACTION_DONE, async (data: any) => {
      this.player.coins = data.coins;
      let cardSold = _.find(this.cards, {_id: data.idCardSold});
      if (cardSold) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        _.remove(this.cards, {_id: data.idCardSold});
        //display the card that was bellow (if stacked)
        _.forEach(this.cards, c => {
          // @ts-ignore
          if (!c.displayed && c.weight == cardSold.weight && c.letter == cardSold.letter) {
            c.displayed = true;
          }
        });
        this.countOccurrencesAndHideDuplicates();
      }
    });
  }

  countOccurrencesAndHideDuplicates() {
    _.orderBy(this.cards, ["weight", "letter"]);
    const countByResult = _.countBy(this.cards, (obj: any) => `${obj.weight}-${obj.letter}`);
    let keyDuplicates: string[] = [];
    for (const c of this.cards) {
      const countKey = `${c.weight}-${c.letter}`;
      c.count = countByResult[countKey] || 0;
      let existCountKey = _.find(keyDuplicates, (k: string) => k === countKey);
      if (c.count > 1 && existCountKey) {
        c.displayed = false;
      }
      if (c.count > 1 && !existCountKey) {
        keyDuplicates.push(countKey);
        c.displayed = true;
      }
    }
  }

  //To prevent memory leak
  duVisible: boolean = false;

  ngOnDestroy(): void {
    if (this.subscription)
      this.subscription.unsubscribe()
  }

  updatePlayer() {
    this.router.navigate(["game", this.idGame, "player", this.idPlayer, "settings"]);
  }

  scan() {
    const dialogRef = this.dialog.open(ScannerDialogComponent, {});
    dialogRef.afterClosed().subscribe(dataRaw => {
      this.buy(dataRaw);
    });
  }

  resurrection() {
    this.router.navigate(['game', this.idGame, 'join', 'true']);
  }

  formatNewCards(newCards: Card[]) {
    for (let c of newCards) {
      c.displayed = true;
      c.count = 1;
    }
    return newCards;
  }

  async receiveCards(newCards: Card[]) {
    const cards = this.formatNewCards(newCards);
    this.cards = _.concat(this.cards, cards);
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.countOccurrencesAndHideDuplicates();
  }

  produceFromSquare($event: Card) {
    const cardsToRemove = _.filter(this.cards, {letter: $event.letter, weight: $event.weight});
    if (cardsToRemove.length === 4 && cardsToRemove[0].count === 4) {
      this.backService.produceFromSquare(this.idGame, this.idPlayer, cardsToRemove).subscribe(async newCards => {
        _.remove(this.cards, {letter: $event.letter, weight: $event.weight,});
        this.receiveCards(newCards);
      });
    } else {
      this.snackbarService.showError("are you trying to cheat???");
    }
  }

  buy(dataRaw: any) {
    let data = JSON.parse(dataRaw);
    if (this.idGame != data.idGame) {
      this.snackbarService.showError("petit malin... c'est une carte d'une autre partie...");
    } else if (this.player.coins >= data.price) {
      const body = {idGame: this.idGame, idBuyer: this.idPlayer, idSeller: data.idOwner, idCard: data.idCard};
      this.backService.transaction(body).subscribe(async dataReceived => {
        if (dataReceived?.buyedCard) {
          this.receiveCards([dataReceived.buyedCard]);
          this.player.coins = dataReceived.coins;
        }
      });
    } else {
      this.snackbarService.showError("Fond insuffisant !");
    }
  }

  onDestroy() {
    // Remember to disconnect the socket when the component is destroyed.
    this.socket.disconnect();
  }
}

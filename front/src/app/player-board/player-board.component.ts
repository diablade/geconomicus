import {createAvatar, Options} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import io from 'socket.io-client';
import {ActivatedRoute, Router} from "@angular/router";
import {Card, Player} from "../models/game";
import {BackService} from "../services/back.service";
import {ScannerDialogComponent} from "../scanner-dialog/scanner-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {environment} from "../../environments/environment";
import * as _ from 'lodash';
import {faCamera} from "@fortawesome/free-solid-svg-icons";
import {SnackbarService} from "../services/snackbar.service";
import {animate, animateChild, query, stagger, style, transition, trigger} from "@angular/animations";
import {LoadingService} from "../services/loading.service";
import {InformationDialogComponent} from "../information-dialog/information-dialog.component";


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
    ])
  ],
  styleUrls: ['./player-board.component.scss']
})
export class PlayerBoardComponent implements OnInit, AfterViewInit {
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
  status: string = "playing";
  money: string = "free";
  cards: Card[] = [];
  faCamera = faCamera;

  constructor(private route: ActivatedRoute, public dialog: MatDialog, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService) {
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

      this.backService.getPlayer(this.idGame, this.idPlayer).subscribe(async player => {
        this.player = player;
        this.status = player.status;
        if (this.player.image === "") {
          this.options.seed = player.name.toString();
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
    this.socket.on("start-game", async (data: any) => {
      console.log("start-game", data);
      this.status = "waiting";
      await this.receiveCards(data.cards);
    });
    this.socket.on("start-round", async (data: any) => {
      this.status = "playing";
      const dialogRef = this.dialog.open(InformationDialogComponent, {
        data: {text: "c'est parti !! le tour à démarré "},
      });
    });
    this.socket.on("stop-round", async (data: any) => {
      this.status = "waiting";
      const dialogRef = this.dialog.open(InformationDialogComponent, {
        data: {text: "tour terminé !"},
      });
    });
    this.socket.on("connected", (data: any) => {
      console.log("connected", data);
    });
    this.socket.on("stop-game", (data: any) => {
      this.snackbarService.showSuccess("Jeu terminé !");
      this.router.navigate(['results', this.idGame]);
    });
    this.socket.on("reset-cards", async (data: any) => {
      console.log("reset-cards");
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.cards = [];
    });
    this.socket.on("transaction-done", async (data: any) => {
      console.log("transaction-done");
      let card = _.find(this.cards, {_id: data.idCardSold});
      if (card) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        _.remove(this.cards, {_id: data.idCardSold});
      }
    });
  }

  countOccurrencesAndHideDuplicates() {
    const countByResult = _.countBy(this.cards, (obj: any) => `${obj.weight}-${obj.letter}`);
    let keyDuplicates: string[] = [];
    for (const c of this.cards) {
      const countKey = `${c.weight}-${c.letter}`;
      c.count = countByResult[countKey] || 0;
      let existCountKey = _.find(keyDuplicates, k => k === countKey);
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
}

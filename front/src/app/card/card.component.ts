import {AfterViewInit, Component, ElementRef, EventEmitter, Input, Output} from '@angular/core';
import {animate, AnimationBuilder, state, style, transition, trigger} from "@angular/animations";
import {Card} from "../models/game";
import {faGift} from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
  animations: [
    trigger("cardFlip", [
      state(
        "default",
        style({
          transform: "none",
          zIndex: "1"
        })
      ),
      state(
        "flipped",
        style({
          transform: "rotateY(180deg) scale(2.2)",
          top: "{{translateY}}px",
          left: "{{translateX}}px",
          zIndex: "99",
        }),
        {params: {translateX: 10, translateY: 10}}
      ),
      transition("default => flipped", [animate("400ms")]),
      transition("flipped => default", [animate("400ms")]),
    ])
  ]
})
export class CardComponent implements AfterViewInit {
  @Input() card: Card = {
    _id: "",
    count: 1,
    color: "",
    letter: "",
    price: 0,
    weight: 0,
    displayed: false,
  };
  @Input() idOwner: string | undefined;
  @Input() idGame: string | undefined;
  @Input() typeMoney: string | undefined;
  @Input() currentDU: number = 1;
  @Input() screenWidth: number = 1;
  @Input() screenHeight: number = 1;
  @Input() amountCardsForProd: number = 4;
  @Input() width: any = 'calc(28vw)';
  @Input() height: any = 'calc(28vw * 1.5)';
  @Input() letterSize: any = 'calc(28vw * 0.33)';
  @Input() priceSize: any = 'calc(25vw * 0.2)';
  @Input() flippable: boolean = true;
  state = "default";
  translateX = 0;
  translateY = 0;
  middleX = 0;
  middleY = 0;
  qrWidthCard = 0;
  protected readonly faGift = faGift;
  @Output() onBuildCardLvlUp: EventEmitter<Card> = new EventEmitter<Card>();

  constructor(private animationBuilder: AnimationBuilder, private elementRef: ElementRef) {
    this.updateScreenSize();
  }

  closeCard() {
    this.state = "default";
  }

  cardClicked() {
    if (this.flippable) {
      this.calculatePosition();
      if (this.state === "default") {
        this.state = "flipped";
      } else {
        this.state = "default";
      }
    }
  }

  getData() {
    return '{ "c":"' + this.card._id
      + '", "o":"' + this.idOwner
      + '", "g":"' + this.idGame
      + '", "p":' + this.card.price
      + '}';
  }

  updateScreenSize() {
    // this.screenWidth = window.innerWidth;
    // this.screenHeight = window.innerHeight;
  }

  calculatePosition() {
    // @ts-ignore
    const element = this.elementRef.nativeElement as HTMLElement;
    // const element = this.cardElementRef.nativeElement as HTMLElement;
    const rect = element.getBoundingClientRect();
    this.qrWidthCard = (28 / 100 * this.screenWidth);
    this.qrWidthCard = this.qrWidthCard > 250 ? 250 : this.qrWidthCard;
    this.qrWidthCard = this.qrWidthCard - 10;

    const positionX = rect.left;
    const positionY = rect.top;
    const width = rect.width;
    const height = rect.height;

    this.middleX = positionX + (width / 2);
    this.middleY = positionY + (height / 2);

    this.translateY = (this.screenHeight / 2) - this.middleY;
    this.translateX = (this.screenWidth / 2) - this.middleX;
  }

  buildCardLvlUp() {
    this.onBuildCardLvlUp.emit(this.card);
  }

  ngOnInit() {
  }

  ngAfterViewInit(): void {
    this.calculatePosition();
    // setTimeout(() => {
    // }, 0);
  }

  getBuildText(card: Card) {
    switch (card.weight) {
      case 0:
        return "Obtenir une carte savoir";
      case 1:
        return "Obtenir une carte Energie";
      case 2:
        return "Obtenir une carte Technologie";
    }
    return "Obtenir une carte supérieur";
  }
}

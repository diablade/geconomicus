import {Component, ElementRef, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {animate, state, style, transition, trigger} from "@angular/animations";
import {Card} from "../models/game";
import {faGift} from "@fortawesome/free-solid-svg-icons";
import {ShortCode} from "../models/shortCode";

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
			transition("default => flipped", [animate("350ms")]),
			transition("flipped => default", [animate("350ms")]),
		])
	]
})
export class CardComponent {
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
	@Input() suffixShortCode: string | undefined;
	@Input() currentDU = 1;
	@Input() screenWidth = 1;
	@Input() screenHeight = 1;
	@Input() amountCardsForProd = 4;
	@Input() width = 'calc(28vw)';
	@Input() height = 'calc(28vw * 1.5)';
	@Input() letterSize = this.screenWidth < this.screenHeight ? 'calc(28vw * 0.33)' : 'calc(28vh * 0.33)';
	@Input() priceSize = this.screenWidth < this.screenHeight ? 'calc(18vw * 0.2)' : 'calc(18vh * 0.2)';
	@Input() flippable = true;
	smallPriceSize = this.screenWidth < this.screenHeight ? 'calc(6vw * 0.2)' : 'calc(6vh * 0.2)';
	state = "default";
	translateX = 0;
	translateY = 0;
	shortCode: ShortCode | undefined;
	faGift = faGift;
	@Output() onBuildCardLvlUp: EventEmitter<Card> = new EventEmitter<Card>();
	@Output() onCreateShortCode: EventEmitter<ShortCode> = new EventEmitter<ShortCode>();
	@ViewChild('cardFlip') cardFlip!: ElementRef;
	@ViewChild('cardBack') cardBack!: ElementRef;

	constructor(private elementRef: ElementRef) {
	}

	closeCard() {
		this.cardBack.nativeElement.play();
		this.state = "default";
	}

	cardClicked() {
		if (this.flippable) {
			this.calculatePosition();
			if (this.state === "default") {
				this.state = "flipped";
				this.createShortCode();
				this.cardFlip.nativeElement.play();
			} else {
				this.cardBack.nativeElement.play();
				this.state = "default";
				this.deleteShortCode();
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

	calculatePosition() {
		// @ts-ignore
		const element = this.elementRef.nativeElement as HTMLElement;
		const rect = element.getBoundingClientRect();

		const positionX = rect.left;
		const positionY = rect.top;
		const width = rect.width;
		const height = rect.height;

		this.translateY = (this.screenHeight / 2) - (positionY + (height / 2));
		this.translateX = (this.screenWidth / 2) - (positionX + (width / 2));
	}

	buildCardLvlUp() {
		this.onBuildCardLvlUp.emit(this.card);
	}

	createShortCode() {
		this.shortCode = new ShortCode(this.getData(), this.suffixShortCode);
		this.onCreateShortCode.emit(this.shortCode);
	}

	deleteShortCode() {
		this.shortCode = undefined;
		this.onCreateShortCode.emit(this.shortCode);
	}

	getBuildText(card: Card) {
		switch (card.weight) {
			case 0:
				return "CARD.BUILD_UP_0";
			case 1:
				return "CARD.BUILD_UP_1";
			case 2:
				return "CARD.BUILD_UP_2";
		}
		return "CARD.BUILD_UP";
	}
}

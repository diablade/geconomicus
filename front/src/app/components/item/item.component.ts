import {Component, ElementRef, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {animate, state, style, transition, trigger} from "@angular/animations";
import {Card} from "../../models/game";
import {faGift} from "@fortawesome/free-solid-svg-icons";
import {ShortCode} from "../../models/shortCode";
import { AudioService } from 'src/app/services/audio.service';

@Component({
	selector: 'app-item',
	templateUrl: './item.component.html',
	styleUrls: ['./item.component.scss'],
	animations: [
		trigger("cardFlip", [
			state(
				"default",
				style({
					transform: "none",
					zIndex: "1",
					width: "{{width}}",
					height: "{{height}}",
				}),
				{params: {translateX: 0, translateY: 0, width: "{{width}}", height: "{{height}}"}}
			),
			state(
				"flipped",
				style({
					transform: "rotateY(180deg) scale(5.0)",
					zIndex: "99",
					top: "{{translateY}}px",
					left: "{{translateX}}px",
					width: "{{width}}",
					height: "{{height}}",
				}),
				{params: {translateX: 0, translateY: 0, width: "{{width}}", height: "{{height}}"}}
				// {params: {translateX: 0, translateY: 0, width: "{{calc(width *2)}}", height: "{{calc(height*2.2)}}"}}
				// {params: {translateX: 0, translateY: 0, width: "{{width scale(2.2)}}", height: "{{height scale(2.2)}}"}}
			),
			transition("default => flipped", [animate("300ms")]),
			transition("flipped => default", [animate("300ms")]),
		])
	]
})
export class ItemComponent {
	@Input() card: Card = {
		_id: "",
		key: "",
		color: "",
		letter: "",
		price: 0,
		weight: 0,
		displayed: true,
		count: 1,
	};
	@Input() idOwner: string | undefined;
	@Input() idGame: string | undefined;
	@Input() typeMoney: string | undefined;
	@Input() suffixShortCode: string | undefined;
	@Input() currentDU = 1;
	@Input() screenWidth = 1;
	@Input() screenHeight = 1;
	@Input() height = this.screenWidth < this.screenHeight ? '18vw':'18vh';
	@Input() width = this.screenWidth < this.screenHeight ? '18vw':'18vh';
	@Input() iconSize = this.screenWidth < this.screenHeight ? '10vw' : '10vh';
	@Input() letterSize = this.screenWidth < this.screenHeight ? '1vw' : '1vw';
	@Input() textSize = this.screenWidth < this.screenHeight ? '1vw' : '1vw';
	@Input() priceSize = this.screenWidth < this.screenHeight ? '10vw' : '10vh';
	@Input() flippable = true;
	smallPriceSize = this.screenWidth < this.screenHeight ? 'calc(7vw * 0.2)' : 'calc(7vh * 0.2)';
	state = "default";
	translateX = 0;
	translateY = 0;
	shortCode: ShortCode | undefined;
	@Output() onCreateShortCode: EventEmitter<ShortCode> = new EventEmitter<ShortCode>();
	// animationParams = {
	// 	translateX: this.translateX,
	// 	translateY: this.translateY,
	// 	width: this.width * 2,
	// 	height: this.height * 3
	// };


	constructor(private elementRef: ElementRef, private audioService: AudioService) {
	}

	closeCard() {
		this.audioService.playSound("cardFlipBack");
		this.state = "default";
	}

	cardClicked() {
		if (this.flippable) {
			this.calculatePosition();
			if (this.state === "default") {
				this.state = "flipped";
				this.createShortCode();
				this.audioService.playSound("cardFlipGet");
			} else {
				this.audioService.playSound("cardFlipBack");
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

	createShortCode() {
		this.shortCode = new ShortCode(this.getData(), this.suffixShortCode);
		this.onCreateShortCode.emit(this.shortCode);
	}

	deleteShortCode() {
		this.shortCode = undefined;
		this.onCreateShortCode.emit(this.shortCode);
	}
}

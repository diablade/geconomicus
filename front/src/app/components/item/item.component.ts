import {Component, ElementRef, EventEmitter, Input, Output} from '@angular/core';
import {Card} from "../../models/gameState";
import {ShortCode} from "../../models/shortCode";
import {AudioService} from 'src/app/services/audio.service';
// @ts-ignore
import { GAME_TYPE } from '@geco/shared';
import {animations} from "../../services/animations";
import {ThemesService} from "../../services/themes.service";

@Component({
	selector: 'app-item',
	templateUrl: './item.component.html',
	styleUrls: ['./item.component.scss'],
	animations
})
export class ItemComponent {
	protected readonly JUNE = GAME_TYPE.JUNE;
	@Input() card: Card = {
		key: "",
		color: "",
		letter: "",
		price: 0,
		weight: 0,
		displayed: true,
		count: 1,
	};
	@Input() ownerIdx: number | undefined;
	@Input() gameStateId: string | undefined;
	@Input() typeMoney: string | undefined;
	@Input() suffixShortCode: string | undefined;
	@Input() currentDU: number | undefined;
	@Input() screenWidth = 1;
	@Input() screenHeight = 1;
	@Input() height = this.screenWidth < this.screenHeight ? '18vw' : '18vh';
	@Input() width = this.screenWidth < this.screenHeight ? '18vw' : '18vh';
	@Input() iconSize = this.screenWidth < this.screenHeight ? '10vw' : '10vh';
	@Input() letterSize = this.screenWidth < this.screenHeight ? '1vw' : '1vw';
	@Input() textSize = this.screenWidth < this.screenHeight ? '1vw' : '1vw';
	@Input() priceSize = this.screenWidth < this.screenHeight ? '10vw' : '10vh';
	@Input() flippable = true;
	@Input() typeTheme: string | null = "";
	smallPriceSize = this.screenWidth < this.screenHeight ? 'calc(7vw * 0.2)' : 'calc(7vh * 0.2)';
	state = "default";
	translateX = 0;
	translateY = 0;
	code: string = '';

	@Output() onChangedShortCode: EventEmitter<ShortCode> = new EventEmitter<ShortCode>();

	constructor(private elementRef: ElementRef, private audioService: AudioService, private themesService: ThemesService) {
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
		return '{ "k":"' + this.card.key
			+ '", "o":"' + this.ownerIdx
			+ '", "g":"' + this.gameStateId
			+ '", "p":' + this.card.price
			+ '}';
	}

	getIcon(icon: string) {
		return this.themesService.getIcon(icon);
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
		const shortCode = new ShortCode(this.getData(), this.suffixShortCode);
		this.code = shortCode.code;
		this.onChangedShortCode.emit(shortCode);
	}

	deleteShortCode() {
		this.code = "";
		this.onChangedShortCode.emit({payload: '', code: ''} as ShortCode);
	}
}

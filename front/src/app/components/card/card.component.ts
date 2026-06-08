import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Card } from '../../models/gameState';
import { ShortCode } from '../../models/shortCode';
import { AudioService } from '../../services/audio.service';
import { animations } from '../../services/animations';

@Component({
	selector: 'app-card',
	templateUrl: './card.component.html',
	styleUrls: ['./card.component.scss'],
	animations,
})
export class CardComponent implements OnChanges {
	@Input() card!: Card;
	@Input() ownerIdx: number | undefined;
	@Input() gameStateId: string | undefined;
	@Input() typeMoney: string | undefined;
	@Input() amountCardsForProd: number | undefined;
	@Input() currentDU: number | undefined;
	@Input() suffixShortCode: string | undefined;
	@Input() screenWidth = 1;
	@Input() screenHeight = 1;
	@Input() width = '';
	@Input() height = '';
	@Input() letterSize = '';
	@Input() priceSize = '';
	@Input() flippable = true;
	smallPriceSize = '';
	state = 'default';
	translateX = 0;
	translateY = 0;
	code = '';
	@Output() buildCardLvlUp: EventEmitter<Card> = new EventEmitter<Card>();
	@Output() shortCodeChanged: EventEmitter<ShortCode> = new EventEmitter<ShortCode>();

	constructor(
		private elementRef: ElementRef,
		private audioService: AudioService
	) {}

        ngOnChanges(changes: SimpleChanges) {
            if (changes['screenWidth'] || changes['screenHeight']) {
                this.recalculateSizes();
            }
        }

	private recalculateSizes() {
		const isPortrait = this.screenWidth < this.screenHeight;
		this.height = this.height ? this.height : isPortrait ? 'calc(28vw * 1.5)' : 'calc(28vh * 1.5)';
		this.width = this.width ? this.width : isPortrait ? '28vw' : '28vh';
		this.letterSize = this.letterSize ? this.letterSize : isPortrait ? 'calc(28vw * 0.33)' : 'calc(28vh * 0.33)';
		this.priceSize = this.priceSize ? this.priceSize : isPortrait ? 'calc(18vw * 0.2)' : 'calc(18vh * 0.2)';
		this.smallPriceSize = this.smallPriceSize
			? this.smallPriceSize
			: isPortrait
				? 'calc(6vw * 0.2)'
				: 'calc(6vh * 0.2)';
	}

	closeCard() {
		this.audioService.playSound('cardFlipBack');
		this.state = 'default';
	}

	cardClicked() {
		if (this.flippable) {
			this.calculatePosition();
			if (this.state === 'default') {
				this.state = 'flipped';
				this.createShortCode();
				this.audioService.playSound('cardFlipGet');
			} else {
				this.audioService.playSound('cardFlipBack');
				this.state = 'default';
				this.deleteShortCode();
			}
		}
	}

	getData() {
		return (
			'{ "k":"' +
			this.card.key +
			'", "o":"' +
			this.ownerIdx +
			'", "g":"' +
			this.gameStateId +
			'", "p":' +
			this.card.price +
			'}'
		);
	}

	calculatePosition() {
		const element = this.elementRef.nativeElement as HTMLElement;
		const rect = element.getBoundingClientRect();

		const positionX = rect.left;
		const positionY = rect.top;
		const width = rect.width;
		const height = rect.height;

		this.translateY = this.screenHeight / 2 - (positionY + height / 2);
		this.translateX = this.screenWidth / 2 - (positionX + width / 2);
	}

	buildCard() {
		this.buildCardLvlUp.emit(this.card);
	}

	createShortCode() {
		const shortCode = new ShortCode(this.getData(), this.suffixShortCode);
		this.code = shortCode.code;
		this.shortCodeChanged.emit(shortCode);
	}

	deleteShortCode() {
		this.code = '';
		this.shortCodeChanged.emit({ payload: '', code: '' } as ShortCode);
	}

	getBuildText(card: Card) {
		switch (card.weight) {
			case 0:
				return 'CARD.BUILD_UP_0';
			case 1:
				return 'CARD.BUILD_UP_1';
			case 2:
				return 'CARD.BUILD_UP_2';
		}
		return 'CARD.BUILD_UP';
	}

	getBuildColor(card: Card) {
		switch (card.weight) {
			case 0:
				return 'yellow';
			case 1:
				return 'green';
			case 2:
				return 'blue';
		}
		return 'red';
	}
}

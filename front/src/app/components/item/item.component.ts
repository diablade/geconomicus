import { Component, ElementRef, EventEmitter, SimpleChanges, Input, Output, OnChanges } from '@angular/core';
import { Card } from '../../models/gameState';
import { ShortCode } from '../../models/shortCode';
import { AudioService } from 'src/app/services/audio.service';
import { GAME_TYPE } from '@geco/shared';
import { animations } from '../../services/animations';
import { ThemesService } from '../../services/themes.service';

@Component({
	selector: 'app-item',
	templateUrl: './item.component.html',
	styleUrls: ['./item.component.scss'],
	animations,
})
export class ItemComponent implements OnChanges {
	protected readonly JUNE = GAME_TYPE.JUNE;
	@Input() card: Card = {
		key: '',
		color: '',
		letter: '',
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
	@Input() height : string | undefined;
	@Input() width : string | undefined;
	@Input() iconSize : string | undefined;
	@Input() letterSize : string | undefined;
	@Input() textSize : string | undefined;
	@Input() priceSize : string | undefined;
	@Input() flippable = true;
	@Input() typeTheme: string | null = '';
	smallPriceSize : string | undefined;
	state = 'default';
	translateX = 0;
	translateY = 0;
	code = '';

	@Output() shortCodeChanged: EventEmitter<ShortCode> = new EventEmitter<ShortCode>();

	constructor(
		private elementRef: ElementRef,
		private audioService: AudioService,
		private themesService: ThemesService
	) {}

    ngOnChanges(changes: SimpleChanges) {
        if (changes['screenWidth'] || changes['screenHeight']) {
            this.recalculateSizes();
        }
    }

	private recalculateSizes() {
		const isPortrait = this.screenWidth < this.screenHeight;
		this.height = this.height ? this.height : (isPortrait ? '28vw' : '28vh');
		this.width = this.width ? this.width : (isPortrait ? '28vw' : '28vh');
		this.iconSize = this.iconSize ? this.iconSize : (isPortrait ? '16vw' : '16vh');
		this.letterSize = this.letterSize ? this.letterSize : (isPortrait ? '2rem' : '2rem');
		this.textSize = this.textSize ? this.textSize : (isPortrait ? '1rem' : '1rem');
		this.priceSize = this.priceSize ? this.priceSize : (isPortrait ? '1rem' : '1rem');
		this.smallPriceSize = this.smallPriceSize ? this.smallPriceSize : (isPortrait ? 'calc(7vw * 0.2)' : 'calc(7vh * 0.2)');
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

	getIcon(icon: string) {
		return this.themesService.getIcon(icon);
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

	createShortCode() {
		const shortCode = new ShortCode(this.getData(), this.suffixShortCode);
		this.code = shortCode.code;
		this.shortCodeChanged.emit(shortCode);
	}

	deleteShortCode() {
		this.code = '';
		this.shortCodeChanged.emit({ payload: '', code: '' } as ShortCode);
	}
}

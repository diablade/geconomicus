import { Component, ElementRef, EventEmitter, SimpleChanges, Input, Output, OnChanges } from '@angular/core';
import { Card } from '../../models/gameState';
import { ShortCode } from '../../models/shortCode';
import { AudioService } from 'src/app/services/audio.service';
import { GAME_TYPE } from '@geco/shared';
import { animations } from '../../services/animations';
import { ThemesService } from '../../services/themes.service';
import { Recipe, getRecipeForCard } from '../../models/recipe';

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
	@Input() shadow = true;
	@Input() gameStateId: string | undefined;
	@Input() typeMoney: string | undefined;
	@Input() suffixShortCode: string | undefined;
	@Input() currentDU: number | undefined;
	@Input() screenWidth = 1;
	@Input() screenHeight = 1;
	@Input() height: string | undefined;
	@Input() width: string | undefined;
	@Input() iconSize: string | undefined;
	@Input() letterSize: string | undefined;
	@Input() textSize: string | undefined;
	@Input() priceSize: string | undefined;
	@Input() flippable = true;
	@Input() typeTheme: string | null = '';
	@Input() allCards: Card[] = [];
	@Input() amountCardsForProd = 4;
	@Input() generatedIdenticalLetters = 5;
	smallPriceSize: string | undefined;
	state = 'default';
	recipe: Recipe | null = null;
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
			const prevIsPortrait = changes['screenWidth']?.previousValue < changes['screenHeight']?.previousValue;
			const nowIsPortrait = this.screenWidth < this.screenHeight;
			const orientationChanged =
				changes['screenWidth'] && changes['screenHeight'] && prevIsPortrait !== nowIsPortrait;
			if (orientationChanged && this.state === 'flipped') {
				this.closeCard();
			}
			this.recalculateSizes();
		}
	}

	private recalculateSizes() {
		const isPortrait = this.screenWidth < this.screenHeight;
		const unit = isPortrait ? 'vw' : 'vh';
		// 3 cards per row: (100 - 2*padding 2.5 - 2*gap 2.5) / 3 = 30, clamped 80px–150px
		if (!this.height) {
			this.height = `clamp(80px, 30${unit}, 150px)`;
		}
		if (!this.width) {
			this.width = `clamp(80px, 30${unit}, 150px)`;
		}

		// Tailles calculées en % de width, seulement si non fournies via @Input
		if (!this.iconSize) {
			this.iconSize = `calc(${this.width} * 0.60)`; // ~60% de width
		}
		if (!this.letterSize) {
			this.letterSize = `calc(${this.width} * 0.35)`; // ~35% de width
		}
		if (!this.textSize) {
			this.textSize = `calc(${this.width} * 0.12)`; // ~12% de width
		}

		this.priceSize = `clamp(7px, 3${unit}, 14px)`;
		this.smallPriceSize = `clamp(5px, 2${unit}, 10px)`;
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
				this.recipe = getRecipeForCard(
					this.card,
					this.allCards,
					this.amountCardsForProd,
					this.generatedIdenticalLetters
				);
				this.audioService.playSound('cardFlipGet');
			} else {
				this.audioService.playSound('cardFlipBack');
				this.state = 'default';
				this.recipe = null;
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

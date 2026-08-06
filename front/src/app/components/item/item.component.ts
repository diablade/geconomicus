import {
	Component,
	ElementRef,
	EventEmitter,
	SimpleChanges,
	Input,
	Output,
	OnChanges,
	OnDestroy,
	ViewChild,
	TemplateRef,
	ViewContainerRef,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Card } from '../../models/gameState';
import { ShortCode } from '../../models/shortCode';
import { AudioService } from 'src/app/services/audio.service';
import { GAME_TYPE } from '@geco/shared';
import { ThemesService } from '../../services/themes.service';
import { Recipe, getRecipeForCard } from '../../models/recipe';

// Doit matcher la durée de transition dans item.component.scss (.flip-card)
const FLIP_DURATION_MS = 450;

@Component({
	selector: 'app-item',
	templateUrl: './item.component.html',
	styleUrls: ['./item.component.scss'],
})
export class ItemComponent implements OnChanges, OnDestroy {
	protected readonly JUNE = GAME_TYPE.JUNE;
	protected readonly FLIP_DURATION_MS = FLIP_DURATION_MS;

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

	/** default = carte dans la grille | flipped = carte affichée dans l'overlay */
	state: 'default' | 'flipped' = 'default';
	/** front = face visible | back = dos visible (piloté en CSS pur) */
	flipState: 'front' | 'back' = 'front';

	recipe: Recipe | null = null;
	code = '';

    gapBackItems='';

	@ViewChild('flippedTemplate') private flippedTemplate!: TemplateRef<unknown>;
	private overlayRef: OverlayRef | null = null;
	private openTimer: ReturnType<typeof setTimeout> | null = null;
	private closeTimer: ReturnType<typeof setTimeout> | null = null;

	@Output() shortCodeChanged: EventEmitter<ShortCode> = new EventEmitter<ShortCode>();

	constructor(
		private elementRef: ElementRef,
		private audioService: AudioService,
		private themesService: ThemesService,
		private overlay: Overlay,
		private viewContainerRef: ViewContainerRef
	) {}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['screenWidth'] || changes['screenHeight']) {
			const prevW = changes['screenWidth']?.previousValue;
			const prevH = changes['screenHeight']?.previousValue;
			const hadPrevious = prevW != null && prevH != null;
			const orientationChanged = hadPrevious && (prevW < prevH) !== (this.screenWidth < this.screenHeight);
			if (orientationChanged && this.state === 'flipped') {
				this.closeCard();
			}
			this.recalculateSizes();
		}
	}

	ngOnDestroy() {
		this.clearTimers();
		this.overlayRef?.dispose();
	}

	private recalculateSizes() {
		// vmin = shorter viewport side, so sizing is orientation-independent
		if (!this.height) {
			this.height = 'clamp(80px, 30vmin, 150px)';
		}
		if (!this.width) {
			this.width = 'clamp(80px, 30vmin, 150px)';
		}
		if (!this.iconSize) {
			this.iconSize = `calc(${this.width} * 0.60)`;
		}
		if (!this.letterSize) {
			this.letterSize = `calc(${this.width} * 0.35)`;
		}
		if (!this.textSize) {
			this.textSize = `calc(${this.width} * 0.12)`;
		}
		this.priceSize = 'clamp(7px, 3vmin, 14px)';
		this.smallPriceSize = 'clamp(5px, 2vmin, 10px)';

        this.gapBackItems= this.height;
	}

	private clearTimers() {
		if (this.openTimer) clearTimeout(this.openTimer);
		if (this.closeTimer) clearTimeout(this.closeTimer);
		this.openTimer = null;
		this.closeTimer = null;
	}

	cardClicked() {
		if (!this.flippable || this.state === 'flipped') {
			return;
		}
		this.clearTimers();

		this.state = 'flipped';
		this.flipState = 'front'; // repart toujours de la face avant
		this.createShortCode();
		this.recipe = getRecipeForCard(
			this.card,
			this.allCards,
			this.amountCardsForProd,
			this.generatedIdenticalLetters
		);
		this.audioService.playSound('cardFlipGet',false);
		this.openOverlay();

		this.openTimer = setTimeout(() => {
			this.flipState = 'back';
		});
	}

	closeCard() {
		if (this.state !== 'flipped') {
			return;
		}
		this.clearTimers();

		this.audioService.playSound('cardFlipBack',false);
		this.flipState = 'front';
		this.recipe = null;
		this.deleteShortCode();

		// On attend la fin de la transition CSS avant de détruire l'overlay,
		// pour voir le retour à la face avant.
		this.closeTimer = setTimeout(() => {
			this.overlayRef?.dispose();
			this.overlayRef = null;
			this.state = 'default';
		}, FLIP_DURATION_MS);
	}

	private openOverlay() {
		const positionStrategy = this.overlay.position().global().centerHorizontally().centerVertically();

		this.overlayRef = this.overlay.create({
			positionStrategy,
			hasBackdrop: true,
			backdropClass: 'item-overlay-backdrop',
			panelClass: 'item-overlay-panel',
			scrollStrategy: this.overlay.scrollStrategies.block(),
		});

		this.overlayRef.backdropClick().subscribe(() => this.closeCard());

		const portal = new TemplatePortal(this.flippedTemplate, this.viewContainerRef);
		this.overlayRef.attach(portal);
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

	getPNG(key: string) {
		return this.themesService.getPNG(key);
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

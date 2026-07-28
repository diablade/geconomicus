import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import confetti from 'canvas-confetti';
import { Card } from '../../models/gameState';
import { Recipe } from '../../models/recipe';
import { ShortCode } from '../../models/shortCode';
import { AudioService } from '../../services/audio.service';
import { ThemesService } from '../../services/themes.service';
import { PlayerStateService } from '../../services/api/player-state.service';

@Component({
	selector: 'app-square-zone',
	templateUrl: './square-zone.component.html',
	styleUrls: ['./square-zone.component.scss'],
})
export class SquareZoneComponent implements OnInit, OnDestroy {
	@Input() group!: { recipe: Recipe; cards: Card[] };
	@Input() typeMoney: string | undefined;
	@Input() typeTheme: string | null = '';
	@Input() ownerIdx: number | undefined;
	@Input() gameStateId: string | undefined;
	@Input() currentDU: number | undefined;
	@Input() allCards: Card[] = [];
	@Input() amountCardsForProd = 4;
	@Input() generatedIdenticalLetters = 5;
	@Input() screenWidth = 1;
	@Input() screenHeight = 1;

	productionReveal: { producedCard: Card; newCards: Card[] } | null = null;
	private productionRevealSub: Subscription | undefined;
	private readonly PRODUCTION_REVEAL_MS = 2500;

	constructor(
		private playerStateService: PlayerStateService,
		private themesService: ThemesService,
		private audioService: AudioService
	) {}

	ngOnInit(): void {
		this.productionRevealSub = this.playerStateService.productionReveal$.subscribe((data) => {
			if (data.letter === this.group.recipe.letter && data.weight === this.group.recipe.weight) {
				this.playReveal(data);
			}
		});
	}

	ngOnDestroy(): void {
		this.productionRevealSub?.unsubscribe();
	}

	get suffixShortCode(): string | undefined {
		return this.ownerIdx?.toString()?.padStart(2, '0');
	}

	getIcon(key: string) {
		return this.themesService.getIcon(key);
	}

	getBuildText(weight: number) {
		switch (weight) {
			case 0:
				return 'CARD.BUILD_UP_0';
			case 1:
				return 'CARD.BUILD_UP_1';
			case 2:
				return 'CARD.BUILD_UP_2';
		}
		return 'CARD.BUILD_UP';
	}

	build() {
		this.playerStateService.produce(this.group.recipe.letter, this.group.recipe.weight);
	}

	onChangedShortCode($event: ShortCode) {
		this.playerStateService.shortCode = $event;
	}

	trackByCard(index: number, card: Card): string {
		return card.key;
	}

	private playReveal(data: { producedCard: Card; newCards: Card[] }): void {
		this.audioService.playSound('gotitem');
		this.productionReveal = data;
		confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
		setTimeout(() => {
			this.productionReveal = null;
			this.playerStateService.commitProduction();
		}, this.PRODUCTION_REVEAL_MS);
	}
}

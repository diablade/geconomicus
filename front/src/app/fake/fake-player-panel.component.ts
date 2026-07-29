import { Component, Input, inject } from '@angular/core';
import { GAME_TYPE } from '@geco/shared';
import { AudioService } from '../services/audio.service';
import { ThemesService } from '../services/themes.service';
import { PlayerStateService } from '../services/api/player-state.service';
import { OverlayConfig } from '../components/overlay/overlay.component';
import { Recipe } from '../models/recipe';
import { Card } from '../models/gameState';
import {
	SOUND_KEYS,
	makeFakeBundle,
	makeFakeProductionGroup,
	makeFakeProducedCard,
	makeFakeLetter,
	FAKE_PROD_WEIGHT,
} from './fake-data';

@Component({
	selector: 'app-fake-player-panel',
	templateUrl: './fake-player-panel.component.html',
	styleUrls: ['./fake-player-panel.component.scss'],
})
export class FakePlayerPanelComponent {
	@Input() screenWidth = 1;
	@Input() screenHeight = 1;

	private audioService = inject(AudioService);
	private themesService = inject(ThemesService);
	private playerStateService = inject(PlayerStateService);

	readonly soundKeys = SOUND_KEYS;
	open = false;
	isJune = false;
	isItemTheme = true;
	autoSeizure = false;

	overlayConfig: OverlayConfig | null = null;
	showPrison = false;
	fakePrison = { remainingTime: 4000, totalTime: 4000 };
	showProdGroup: { recipe: Recipe; cards: Card[] } | null = null;
	showWheel = false;
	private prisonTimeout: any = null;

	private readonly TEST_MS = 4000;

	toggleOpen(): void {
		this.open = !this.open;
	}

	toggleMoney(): void {
		this.isJune = !this.isJune;
		this.reload();
	}

	toggleTheme(): void {
		this.isItemTheme = !this.isItemTheme;
		this.applyTheme();
	}

	toggleAutoSeizure(): void {
		this.autoSeizure = !this.autoSeizure;
		this.reload();
	}

	private reload(): void {
		const typeMoney = this.isJune ? GAME_TYPE.JUNE : GAME_TYPE.DEBT;
		this.playerStateService.loadFake(makeFakeBundle(typeMoney, this.autoSeizure));
	}

	private applyTheme(): void {
		this.themesService.loadTheme(this.isItemTheme ? 'THEME.EMOJIS' : 'THEME.CLASSIC');
	}

	// ── Overlay tests (all 4s, dismissable) ───────────────────────────────────
	testReincarnate(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '☠️',
					text: 'PLAYER.THIS_LIFE_IS_GONE',
					bg: 'reincarnate-death',
					sound: 'dead',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
				{
					icon: '👶',
					text: 'PLAYER.GO_TO_SECOND_LIFE',
					bg: 'reincarnate-rebirth',
					sound: 'angel',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
			],
		};
	}

	testAlarm(): void {
		this.overlayConfig = {
			phases: [
				{ icon: '⏰', text: 'CREDIT.FINAL_MINUTE', bg: 'alarm', durationMs: this.TEST_MS, dismissable: true },
			],
		};
	}

	testFault(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '🚨',
					title: 'CREDIT.FAULT_OVERLAY_TITLE',
					text: this.autoSeizure ? 'CREDIT.FAULT_OVERLAY_TEXT_AUTO' : 'CREDIT.FAULT_OVERLAY_TEXT',
					bg: 'police',
					sound: 'police',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
			],
		};
	}

	testTakeover(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '🎬',
					title: 'PLAYER.TAKEN_OVER_TITLE',
					text: 'PLAYER.TAKEN_OVER_TEXT',
					bg: 'takeover',
					durationMs: this.TEST_MS,
					dismissable: true,
					button: { labelKey: 'PLAYER.RETAKE' },
				},
			],
		};
	}

	onOverlayDone(): void {
		this.overlayConfig = null;
	}

	testPrison(): void {
		this.fakePrison = { remainingTime: this.TEST_MS, totalTime: this.TEST_MS };
		this.showPrison = true;
		clearTimeout(this.prisonTimeout);
		this.prisonTimeout = setTimeout(() => (this.showPrison = false), this.TEST_MS);
	}

	toggleProdGroup(): void {
		this.showProdGroup = this.showProdGroup ? null : makeFakeProductionGroup();
	}

	toggleWheel(): void {
		this.showWheel = !this.showWheel;
	}

	triggerProduction(): void {
		if (!this.showProdGroup) this.showProdGroup = makeFakeProductionGroup();
		this.playerStateService.triggerFakeProduction(
			makeFakeLetter(),
			FAKE_PROD_WEIGHT,
			makeFakeProducedCard(),
			makeFakeProductionGroup().cards
		);
	}

	playSound(key: string): void {
		this.audioService.playSound(key);
	}
}

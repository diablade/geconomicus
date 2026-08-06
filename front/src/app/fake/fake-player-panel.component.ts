import { Component, Input, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import confetti from 'canvas-confetti';
import { GAME_TYPE } from '@geco/shared';
import { AudioService } from '../services/audio.service';
import { HapticService, HapticTier, HAPTIC_TIERS } from '../services/haptic.service';
import { I18nService } from '../services/i18n.service';
import { SnackbarService } from '../services/snackbar.service';
import { ThemesService } from '../services/themes.service';
import { PlayerStateService } from '../services/api/player-state.service';
import { OverlayConfig } from '../components/overlay/overlay.component';
import { InformationDialogComponent } from '../dialogs/information-dialog/information-dialog.component';
import { Recipe } from '../models/recipe';
import { Card } from '../models/gameState';
import {
	SOUND_KEYS,
	makeFakeBundle,
	makeFakeRate,
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
	private hapticService = inject(HapticService);
	private themesService = inject(ThemesService);
	private playerStateService = inject(PlayerStateService);
	private i18nService = inject(I18nService);
	private snackbarService = inject(SnackbarService);
	private dialog = inject(MatDialog);

	readonly soundKeys = SOUND_KEYS;
	readonly hapticTiers = HAPTIC_TIERS;
	open = false;
	isJune = false;
	autoSeizure = false;

	readonly themeKeys = this.themesService.getThemesKeys();
	themeIndex = Math.max(0, this.themeKeys.indexOf('THEME.EMOJIS'));

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

	cycleTheme(): void {
		this.themeIndex = (this.themeIndex + 1) % this.themeKeys.length;
		this.applyTheme();
	}

	get themeLabel(): string {
		return this.themesService.getThemeName(this.themeKeys[this.themeIndex]);
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
		this.themesService.loadTheme(this.themeKeys[this.themeIndex]);
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

	testHalfway(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '⏰',
					text: 'CREDIT.HALFWAY_NUDGE',
					bg: 'halfway',
					sound: 'nudge',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
			],
		};
	}

	testAlarm(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '⚠️',
					text: 'CREDIT.FINAL_MINUTE',
					bg: 'alarm',
					sound: 'high_alarm',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
			],
		};
	}

	testRateZero(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '0%',
					text: 'CREDIT.RATE_HURRY',
					bg: 'rate-zero',
					wheel: true,
					sound: 'notif2',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
			],
		};
	}

	testRateDialog(): void {
		const rate = makeFakeRate();
		this.dialog.open(InformationDialogComponent, {
			data: {
				title: this.i18nService.instant('DIALOG.RATE_CHANGED.TITLE'),
				message: this.i18nService.instant('CREDIT.RATE_CHANGED', {
					amount: rate.amount,
					interest: rate.interest,
					pct: Math.round(rate.pct * 100),
				}),
				message2: this.i18nService.instant('CREDIT.RATE_HURRY'),
				sound: 'notif2',
			},
		});
	}

	testFault(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '🚨',
					title: 'CREDIT.FAULT_OVERLAY_TITLE',
					text: this.autoSeizure ? 'CREDIT.FAULT_OVERLAY_TEXT_AUTO' : 'CREDIT.FAULT_OVERLAY_TEXT',
					bg: 'police',
					sound: this.autoSeizure ? 'police2' : 'police',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
			],
		};
	}

	testPrisonFree(): void {
		this.overlayConfig = {
			phases: [
				{
					icon: '🕊️',
					title: 'PLAYER.OUT_PRISON_TITLE',
					text: 'PLAYER.OUT_PRISON_TEXT',
					bg: 'free',
					sound: 'outPrison',
					durationMs: this.TEST_MS,
					dismissable: true,
				},
			],
		};
		confetti({ particleCount: 160, spread: 110, origin: { y: 0.6 } });
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

	setCreditRemaining(seconds: number): void {
		this.playerStateService.setFakeCreditRemaining(seconds * 1000);
	}

	testRefused(): void {
		this.audioService.playSound('glitch');
		this.snackbarService.showError(this.i18nService.instant('CREDIT.REFUSED_NEGOTIATE'));
	}

	testSettled(): void {
		this.audioService.playSound('done');
		this.snackbarService.showSuccess(this.i18nService.instant('CREDIT.CREDIT_SETTLED'));
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

	vibrateTier(tier: HapticTier): void {
		this.hapticService.vibrate(tier);
	}
}

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActionService } from '../../services/api/action.service';
import { ActionConfig, getActionIcon } from '../../models/rules';
import { Card } from '../../models/gameState';
import { I18nService } from '../../services/i18n.service';
import { ThemesService } from '../../services/themes.service';
import { InformationDialogComponent } from '../information-dialog/information-dialog.component';
import _ from 'lodash';

export interface SessionAvatar {
	idx: number;
	name: string;
	image: string;
}

export interface ActionDialogData {
	gameStateId: string;
    gameStatus: string;
	sessionId: string;
	playerStateIdx: number;
	actionTokens: number;
	actions: ActionConfig[];
	myCards: Card[];
	typeMoney: string;
	currentDU?: number;
	typeTheme: string;
	sessionAvatars: SessionAvatar[];
	fake?: boolean;
}

export interface AvailablePlayer {
	idx: number;
	name: string;
	avatarIdx: number;
}

type Step = 'shop' | 'pick-who-card' | 'pick-target' | 'pick-target2' | 'pick-card' | 'pick-ong-cards' | 'pick-association-cards' | 'confirming';

@Component({
	selector: 'app-action-dialog',
	templateUrl: './action-dialog.component.html',
	styleUrls: ['./action-dialog.component.scss'],
})
export class ActionDialogComponent {
	step: Step = 'shop';
	selectedAction: ActionConfig | null = null;

	availablePlayers: AvailablePlayer[] = [];
	playersLoading = false;
	playersError = '';
	selectedTarget1: AvailablePlayer | null = null;
	selectedTarget2: AvailablePlayer | null = null;

	targetCards: Card[] = [];
	selectedCard: Card | null = null;
	targetCardsLoading = false;
	targetCardsError = '';

	selectedOngCards: Card[] = [];
	selectedAssociationCards: Card[] = [];

    get famillyCards(): Card[] { return _.uniqBy(this.data.myCards, 'letter'); }

	get associationCardForStep(): Card | null {
		return this.selectedAssociationCards[this.step === 'pick-target2' ? 1 : 0] ?? null;
	}

	whoHaveCardLoading = false;

	error = '';
	loading = false;

	readonly dialogCardSize = '70px';
	readonly dialogIconSize = '45px';
	readonly dialogLetterSize = '25px';
	readonly dialogTextSize = '10px';

	constructor(
		public dialogRef: MatDialogRef<ActionDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: ActionDialogData,
		private actionService: ActionService,
		private i18n: I18nService,
		private themesService: ThemesService,
		private dialog: MatDialog
	) {
		this.i18n.loadNamespace('action');
	}

    getActionIcon = getActionIcon;

	getAvatar(avatarIdx: number): SessionAvatar | undefined {
		return this.data.sessionAvatars.find((a) => +a.idx === +avatarIdx);
	}

	getFamilyIcon(card: Card): string {
		return this.themesService.getIcon(card.letter) || card.letter;
	}

	canAfford(action: ActionConfig): boolean {
		return this.data.actionTokens >= action.cost;
	}

	// ── Shop ─────────────────────────────────────────────────────────────────────

	selectAction(action: ActionConfig) {
		if (!this.canAfford(action) || !action.enabled) return;
		this.selectedAction = action;
		this.selectedCard = null;
		this.selectedTarget1 = null;
		this.selectedTarget2 = null;
		this.error = '';

		if (action.key === 'ong') {
			this.step = 'pick-ong-cards';
		} else if (action.key === 'association') {
			this.selectedAssociationCards = [];
			this.step = 'pick-association-cards';
		} else if (action.key === 'whoHaveCard') {
			this.step = 'pick-who-card';
		} else {
			this.loadAvailablePlayers(() => {
				this.step = 'pick-target';
			});
		}
	}

	private loadAvailablePlayers(onSuccess: () => void) {
		if (this.data.fake) {
			this.availablePlayers = this.fakePlayers();
			this.playersLoading = false;
			onSuccess();
			return;
		}
		this.playersLoading = true;
		this.playersError = '';
		this.actionService.getAvailablePlayers(this.data.gameStateId, this.data.playerStateIdx).subscribe({
			next: (res) => {
				this.availablePlayers = res.players;
				this.playersLoading = false;
				onSuccess();
			},
			error: (err) => {
				this.playersError = err?.error?.message || 'ERROR.GENERIC';
				this.playersLoading = false;
			},
		});
	}

	// ── Who have card ─────────────────────────────────────────────────────────────

	selectWhoHaveCard(card: Card) {
		if (!this.whoHaveCardLoading) this.selectedCard = card;
	}

	confirmWhoHaveCard() {
		if (!this.selectedCard || this.whoHaveCardLoading) return;
		if (this.data.fake) return this.fakeClose();
		this.whoHaveCardLoading = true;
		this.error = '';
		this.actionService.whoHaveCard(this.data.gameStateId, this.data.playerStateIdx, this.selectedCard.key).subscribe({
			next: (res) => {
				this.whoHaveCardLoading = false;
				this.data.actionTokens = res.actionTokens;
				const ownerAvatarIdx = res.avatarIdx;
				const avatar = ownerAvatarIdx != null ? this.data.sessionAvatars.find((a) => +a.idx === +ownerAvatarIdx) : undefined;
				const name = avatar?.name || '';
				let message: string;
				if (res.status === 'player') {
					message = this.i18n.instant('ACTION.WHO_HAVE_CARD.RESULT_PLAYER', { name });
				} else if (res.status === 'deck') {
					message = this.i18n.instant('ACTION.WHO_HAVE_CARD.RESULT_DECK');
				} else {
					message = this.i18n.instant('ACTION.WHO_HAVE_CARD.RESULT_UNKNOWN');
				}
				this.dialogRef.close({ success: true, result: { actionTokens: res.actionTokens }, actionKey: 'whoHaveCard' });
				this.dialog.open(InformationDialogComponent, { data: { message } });
			},
			error: (err) => {
				this.error = err?.error?.message || 'ERROR.GENERIC';
				this.whoHaveCardLoading = false;
			},
		});
	}

	// ── Target selection ──────────────────────────────────────────────────────────

	isTargetSelected(player: AvailablePlayer): boolean {
		if (this.step === 'pick-target2') return this.selectedTarget2?.idx === player.idx;
		return this.selectedTarget1?.idx === player.idx;
	}

	highlightTarget(player: AvailablePlayer) {
		if (this.step === 'pick-target2') {
			if (player.idx === this.selectedTarget1?.idx) return;
			this.selectedTarget2 = player;
		} else {
			this.selectedTarget1 = player;
		}
		this.error = '';
	}

	confirmTarget() {
		if (this.step === 'pick-target2') {
			if (!this.selectedTarget2) return;
			this.step = 'confirming';
			if (this.selectedAction?.key === 'association') {
				this.executeAssociation();
			} else {
				this.executeWar();
			}
		} else {
			if (!this.selectedTarget1) return;
			if (this.selectedAction?.key === 'war' || this.selectedAction?.key === 'association') {
				this.selectedTarget2 = null;
				this.step = 'pick-target2';
			} else if (this.selectedAction?.key === 'give') {
				this.selectedCard = null;
				this.step = 'pick-card';
			} else {
				this.selectedCard = null;
				this.fetchTargetCards(this.selectedTarget1);
			}
		}
	}

	// ── Card selection ────────────────────────────────────────────────────────────

	highlightCard(card: Card) {
		this.selectedCard = card;
		this.error = '';
	}

	confirmCard() {
		if (!this.selectedCard) return;
		this.executeCardAction();
	}

	private fetchTargetCards(target: AvailablePlayer) {
		if (this.data.fake) {
			this.targetCards = this.data.myCards.slice(0, 3);
			this.targetCardsLoading = false;
			this.step = 'pick-card';
			return;
		}
		this.targetCardsLoading = true;
		this.targetCardsError = '';
		this.actionService.getTargetCards(this.data.gameStateId, target.idx).subscribe({
			next: (res) => {
				this.targetCards = res.cards;
				this.targetCardsLoading = false;
				this.step = 'pick-card';
			},
			error: (err) => {
				this.targetCardsError = err?.error?.message || 'ERROR.GENERIC';
				this.targetCardsLoading = false;
			},
		});
	}

	toggleOngCard(card: Card) {
		const idx = this.selectedOngCards.findIndex((c) => c.key === card.key);
		if (idx >= 0) {
			this.selectedOngCards = this.selectedOngCards.filter((c) => c.key !== card.key);
		} else if (this.selectedOngCards.length < 4) {
			this.selectedOngCards = [...this.selectedOngCards, card];
		}
	}

	isOngCardSelected(card: Card): boolean {
		return this.selectedOngCards.some((c) => c.key === card.key);
	}

	toggleAssociationCard(card: Card) {
		const idx = this.selectedAssociationCards.findIndex((c) => c.key === card.key);
		if (idx >= 0) {
			this.selectedAssociationCards = this.selectedAssociationCards.filter((c) => c.key !== card.key);
		} else if (this.selectedAssociationCards.length < 2) {
			this.selectedAssociationCards = [...this.selectedAssociationCards, card];
		}
	}

	isAssociationCardSelected(card: Card): boolean {
		return this.selectedAssociationCards.some((c) => c.key === card.key);
	}

	confirmAssociationCards() {
		if (this.selectedAssociationCards.length !== 2) return;
		this.loadAvailablePlayers(() => {
			this.step = 'pick-target';
		});
	}

	private executeCardAction() {
		if (!this.selectedAction || !this.selectedTarget1 || !this.selectedCard) return;
		if (this.data.fake) return this.fakeClose();
		this.loading = true;
		this.error = '';

		const { gameStateId, playerStateIdx } = this.data;
		const cardKey = this.selectedCard.key;
		const targetIdx = this.selectedTarget1.idx;

		let obs$;
		if (this.selectedAction.key === 'give') {
			obs$ = this.actionService.give(gameStateId, playerStateIdx, targetIdx, cardKey);
		} else if (this.selectedAction.key === 'steal') {
			obs$ = this.actionService.steal(gameStateId, playerStateIdx, targetIdx, cardKey);
		} else {
			obs$ = this.actionService.silentSteal(gameStateId, playerStateIdx, targetIdx, cardKey);
		}

		obs$.subscribe({
			next: (result: any) => {
				this.dialogRef.close({ success: true, result, actionKey: this.selectedAction!.key });
			},
			error: (err: any) => {
				this.error = err?.error?.message || 'ERROR.GENERIC';
				this.loading = false;
			},
		});
	}

	private executeWar() {
		if (!this.selectedTarget1 || !this.selectedTarget2) return;
		if (this.data.fake) return this.fakeClose();
		this.loading = true;
		this.error = '';

		this.actionService
			.war(this.data.gameStateId, this.data.playerStateIdx, this.selectedTarget1.idx, this.selectedTarget2.idx)
			.subscribe({
				next: (result: any) => {
					this.dialogRef.close({ success: true, result, actionKey: 'war' });
				},
				error: (err: any) => {
					this.error = err?.error?.message || 'ERROR.GENERIC';
					this.loading = false;
					this.step = 'pick-target2';
				},
			});
	}

	private executeAssociation() {
		if (this.selectedAssociationCards.length !== 2 || !this.selectedTarget1 || !this.selectedTarget2) return;
		if (this.data.fake) return this.fakeClose();
		this.loading = true;
		this.error = '';

		this.actionService
			.association(
				this.data.gameStateId,
				this.data.playerStateIdx,
				this.selectedAssociationCards.map((c) => c.key),
				[this.selectedTarget1.idx, this.selectedTarget2.idx]
			)
			.subscribe({
				next: (result: any) => {
					this.dialogRef.close({ success: true, result, actionKey: 'association' });
				},
				error: (err: any) => {
					this.error = err?.error?.message || 'ERROR.GENERIC';
					this.loading = false;
					this.step = 'pick-target2';
				},
			});
	}

	confirmOng(useAutoTargets: boolean) {
		if (this.selectedOngCards.length !== 4) return;
		if (this.data.fake) return this.fakeClose();
		this.loading = true;
		this.error = '';

		const manualTargetIdxs = useAutoTargets
			? undefined
			: ([this.selectedTarget1?.idx, this.selectedTarget2?.idx].filter((v) => v !== undefined) as number[]);

		this.actionService
			.ong(
				this.data.gameStateId,
				this.data.playerStateIdx,
				this.selectedOngCards.map((c) => c.key),
				manualTargetIdxs?.length === 2 ? manualTargetIdxs : undefined
			)
			.subscribe({
				next: (result: any) => {
					this.dialogRef.close({ success: true, result, actionKey: 'ong' });
				},
				error: (err: any) => {
					this.error = err?.error?.message || 'ERROR.GENERIC';
					this.loading = false;
				},
			});
	}

	back() {
		this.error = '';
		this.targetCards = [];
		this.selectedCard = null;
		this.targetCardsError = '';

		if (this.step === 'pick-who-card') {
			this.step = 'shop';
			this.selectedAction = null;
		} else if (this.step === 'pick-target') {
			this.selectedTarget1 = null;
			if (this.selectedAction?.key === 'association') {
				this.step = 'pick-association-cards';
			} else {
				this.step = 'shop';
				this.selectedAction = null;
				this.availablePlayers = [];
			}
		} else if (this.step === 'pick-target2') {
			this.step = 'pick-target';
			this.selectedTarget2 = null;
		} else if (this.step === 'pick-card') {
			this.step = 'pick-target';
			this.selectedTarget1 = null;
		} else if (this.step === 'pick-ong-cards') {
			this.step = 'shop';
			this.selectedAction = null;
			this.selectedOngCards = [];
		} else if (this.step === 'pick-association-cards') {
			this.step = 'shop';
			this.selectedAction = null;
			this.availablePlayers = [];
			this.selectedAssociationCards = [];
		}
	}

	close() {
		this.dialogRef.close(null);
	}

	// ── Fake harness: walk the whole flow with local data, never touch the backend ──
	private fakePlayers(): AvailablePlayer[] {
		if (this.data.sessionAvatars.length) {
			return this.data.sessionAvatars.map((a) => ({ idx: a.idx, name: a.name, avatarIdx: a.idx }));
		}
		return [
			{ idx: 1, name: 'Alice', avatarIdx: 1 },
			{ idx: 2, name: 'Bob', avatarIdx: 2 },
			{ idx: 3, name: 'Chloé', avatarIdx: 3 },
		];
	}

	private fakeClose(): void {
		this.dialogRef.close(null);
	}
}

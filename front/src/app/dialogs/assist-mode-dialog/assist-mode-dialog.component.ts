import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ASSIST_MODE, AssistMode } from '@geco/shared';

/**
 * Asked when the animator opens "play the user" on a player who is currently live.
 * Closes with the chosen AssistMode, or undefined on cancel. See ADR-0002.
 */
@Component({
	selector: 'app-assist-mode-dialog',
	templateUrl: './assist-mode-dialog.component.html',
	styleUrls: ['./assist-mode-dialog.component.scss'],
})
export class AssistModeDialogComponent {
	readonly ASSIST_MODE = ASSIST_MODE;
	playerName = '';

	constructor(
		public dialogRef: MatDialogRef<AssistModeDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: { playerName?: string }
	) {
		this.playerName = data?.playerName || '';
	}

	choose(mode: AssistMode): void {
		this.dialogRef.close(mode);
	}
}

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18nService } from '../../services/i18n.service';
import { AudioService } from '../../services/audio.service';

@Component({
	selector: 'app-information-dialog',
	templateUrl: './information-dialog.component.html',
	styleUrls: ['./information-dialog.component.scss'],
})
export class InformationDialogComponent {
	title = 'DIALOG.INFORMATION.TITLE';
	labelBtn = 'DIALOG.CLOSE';
	timerBtn = 5;
	disableClose = false;
	message = '';
	message2 = '';

	constructor(
		public dialogRef: MatDialogRef<InformationDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private i18nService: I18nService,
		private audioService: AudioService
	) {
		this.message = data.message || '';
		this.message2 = data.message2 || '';
		this.title = data.title || this.title;
		this.labelBtn = data.labelBtn || this.labelBtn;
		this.timerBtn = data.timerBtn || this.timerBtn;
		if (data.sound) {
			this.audioService.playSound(data.sound);
		}
	}

    timerEnd(): void {
        this.dialogRef.close();
    }
}

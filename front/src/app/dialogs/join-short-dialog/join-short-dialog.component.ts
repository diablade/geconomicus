import { Component, Inject } from '@angular/core';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18nService } from '../../services/i18n.service';
import Keyboard from 'simple-keyboard';

@Component({
	selector: 'app-join-short-dialog',
	templateUrl: './join-short-dialog.component.html',
	styleUrls: ['./join-short-dialog.component.scss'],
})
export class JoinShortDialogComponent {
	shortId = '';
	faXmark = faXmark;
	keyboard!: Keyboard;

	constructor(
		public dialogRef: MatDialogRef<JoinShortDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private i18n: I18nService
	) {
		this.i18n.loadNamespace('join');
	}

	ngAfterViewInit() {
		this.keyboard = new Keyboard({
			onKeyPress: (button) => this.onKeyPress(button),
			layout: {
				default: ['1 2 3', '4 5 6', '7 8 9', '0'],
			},
			display: {},
			theme: 'hg-theme-default hg-layout-numeric numeric-theme',
		});
	}
	onKeyPress = (button: string) => {
		if (button === '{bksp}') {
			this.shortId = '';
		} else if (this.shortId.length < 4) {
			this.shortId += button;
		}
	};

	join() {
		this.dialogRef.close(this.shortId);
	}
}

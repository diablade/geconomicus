import {AfterViewInit, Component} from '@angular/core';
import Keyboard from "simple-keyboard";
import {MatDialogRef} from "@angular/material/dialog";
import { I18nService } from '../../services/i18n.service';

@Component({
	selector: 'app-shortcode-dialog',
	templateUrl: './shortcode-dialog.component.html',
	styleUrls: ['./shortcode-dialog.component.scss']
})
export class ShortcodeDialogComponent implements AfterViewInit {
	value = "";
	buy = "";
	keyboard!: Keyboard;

	constructor(
		private i18nService: I18nService,
		public dialogRef: MatDialogRef<ShortcodeDialogComponent>) {
		this.i18nService.get("DIALOG.SHORT_CODE.BUY").subscribe((text) => {
			this.buy = text;
		});
	}

	ngAfterViewInit() {
		this.keyboard = new Keyboard({
			// onChange: input => this.onChange(input),
			onKeyPress: button => this.onKeyPress(button),
			layout: {
				default: [
					"1 2 3",
					"4 5 6",
					"7 8 9",
					"{cancel} 0 {bksp}",
					"{buy}"],
			},
			display: {
				'{bksp}': '⌫',
				'{buy}': this.buy,
				'{cancel}': 'X',
			},
			theme: "hg-theme-default hg-layout-numeric numeric-theme"
		});
	}

	onKeyPress = (button: string) => {
		if (button === "{cancel}") {
			this.dialogRef.close();
		} else if (button === "{buy}") {
			this.dialogRef.close(this.value);
		} else if (button === "{bksp}") {
			this.value = "";
		} else if (this.value.length < 3) {
			this.value += button;
		}
	};
}

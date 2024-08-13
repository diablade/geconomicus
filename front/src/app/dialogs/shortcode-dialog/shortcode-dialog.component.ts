import {AfterViewInit, Component} from '@angular/core';
import Keyboard from "simple-keyboard";
import {MatDialogRef} from "@angular/material/dialog";

@Component({
	selector: 'app-shortcode-dialog',
	templateUrl: './shortcode-dialog.component.html',
	styleUrls: ['./shortcode-dialog.component.scss']
})
export class ShortcodeDialogComponent implements AfterViewInit{
	value = "";
	keyboard!: Keyboard;

	constructor(public dialogRef: MatDialogRef<ShortcodeDialogComponent>) {
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
				'{buy}': 'Acheter',
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

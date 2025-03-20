import {Component, Input} from '@angular/core';
import {GameInfosDialog} from "../../master-board/master-board.component";
import {MatDialog} from "@angular/material/dialog";
import {faCircleInfo} from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: 'app-notice-btn',
  templateUrl: './notice-btn.component.html',
  styleUrls: ['./notice-btn.component.scss']
})
export class NoticeBtnComponent {
	protected readonly faInfo = faCircleInfo;
	@Input() labelBtn= "GAME_NOTICE";
	@Input() icon= true;
	@Input() stroked=false;

	constructor(public dialog: MatDialog) {
	}

	showRules() {
		this.dialog.open(GameInfosDialog, {});
	}
}

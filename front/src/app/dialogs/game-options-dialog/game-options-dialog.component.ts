import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {Game} from "../../models/game";
// @ts-ignore
import * as C from "../../../../../config/constantes";
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-game-options-dialog',
  templateUrl: './game-options-dialog.component.html',
  styleUrls: ['./game-options-dialog.component.scss']
})
export class GameOptionsDialogComponent {
  game: Game;
  C = C;

  constructor(
    private i18nService: I18nService,
    public dialogRef: MatDialogRef<GameOptionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.game = data.game;
  }

  onNoClick() {
    this.dialogRef.close("cancel");
  }

  onReset() {
    this.dialogRef.close("reset");
  }

	getTranslate(key: string):string {
		 return this.i18nService.instant(key);
	}

	protected readonly Math = Math;
}

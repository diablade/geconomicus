import {Component, Inject} from '@angular/core';
import {MatSelectChange} from "@angular/material/select";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {Game} from "../../models/game";

@Component({
  selector: 'app-game-options-dialog',
  templateUrl: './game-options-dialog.component.html',
  styleUrls: ['./game-options-dialog.component.scss']
})
export class GameOptionsDialogComponent {
  game: Game;

  constructor(public dialogRef: MatDialogRef<GameOptionsDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
   this.game=data.game;
  }

  onNoClick() {
    this.dialogRef.close();
  }
}

import {Component, Inject, Input} from '@angular/core';
import {BackService} from "../../services/back.service";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-credits-dialog',
  templateUrl: './credits-dialog.component.html',
  styleUrls: ['./credits-dialog.component.scss']
})
export class CreditsDialogComponent {
  idGame: string | undefined;
  idPlayer: string | undefined;
  playerName: string= "";
  credits: any;

  constructor(private backService: BackService,public dialogRef: MatDialogRef<CreditsDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.idGame = data.idGame;
    this.idPlayer = data.idPlayer;
    this.playerName = data.playerName;
  }

  onClose() {
    this.dialogRef.close();
  }

  ngOnInit() {
    this.backService.getPlayerCredits(this.idGame, this.idPlayer).subscribe(data => {
      this.credits = data;
    })
  }

  settlementDebt(credit: any) {

  }
}

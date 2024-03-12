import {Component, Inject} from '@angular/core';
import {Game, Player} from "../../models/game";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {faFileSignature} from "@fortawesome/free-solid-svg-icons";
// @ts-ignore
import * as C from "../../../../../config/constantes";
import * as _ from 'lodash-es';

@Component({
  selector: 'app-contract-dialog',
  templateUrl: './contract-dialog.component.html',
  styleUrls: ['./contract-dialog.component.scss']
})
export class ContractDialogComponent {

  faFileSignature = faFileSignature;
  game: Game = new Game();
  C = C;
  idPlayer: Player | undefined;

  constructor(public dialogRef: MatDialogRef<ContractDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.game = data.game;
  }

  cancel() {
    this.dialogRef.close();
  }

  saveUserCredit() {
    this.dialogRef.close({
      idPlayer: this.idPlayer,
      amount: this.game.defaultCreditAmount,
      interest: this.game.defaultInterestAmount
    });
  }
}

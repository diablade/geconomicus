import {Component, Inject, Input} from '@angular/core';
import {BackService} from "../../services/back.service";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {ConfirmDialogComponent} from "../confirm-dialog/confirm-dialog.component";
import {Credit, Player} from "../../models/game";
import {SnackbarService} from "../../services/snackbar.service";

@Component({
  selector: 'app-credits-dialog',
  templateUrl: './credits-dialog.component.html',
  styleUrls: ['./credits-dialog.component.scss']
})
export class CreditsDialogComponent {
  idGame: string | undefined;
  player: Player | undefined;
  credits: any;

  constructor(private dialog: MatDialog, private snackbarService: SnackbarService, private backService: BackService, public dialogRef: MatDialogRef<CreditsDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.idGame = data.idGame;
    this.player = data.player;
  }

  onClose() {
    this.dialogRef.close();
  }

  ngOnInit() {
    this.backService.getPlayerCredits(this.idGame, this.player?._id).subscribe(data => {
      this.credits = data;
    })
  }

  openConfirmationDialog(credit: Credit): void {
    const confDialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        message: "Etes vous sur de rembourser votre crédit , en payant: " + (credit.amount + credit.interest) + " ?",
        labelBtn1: "Rembourser intégralement",
        labelBtn2: "Annuler",
      }
    });
    confDialogRef.afterClosed().subscribe(result => {
      if (result && result == "btn1") {
        this.backService.settleCredit(credit).subscribe(data => {
        });
        if (this.player && this.player.coins >= (credit.amount + credit.interest)) {
          this.backService.settleCredit(credit).subscribe(data => {
            if (data) {

            }
          });
        } else {
          this.snackbarService.showError("Fond insuffisant...");
        }
      }
    });
  }
}

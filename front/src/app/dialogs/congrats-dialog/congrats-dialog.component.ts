import {Component, Inject, Input} from '@angular/core';
import {Card} from "../../models/game";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-congrats-dialog',
  templateUrl: './congrats-dialog.component.html',
  styleUrls: ['./congrats-dialog.component.scss']
})
export class CongratsDialogComponent {
  @Input() card!: Card;
  @Input() text!: string;

  constructor(public dialogRef: MatDialogRef<CongratsDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.text = data.text;
    this.card = data.card;
  }
}

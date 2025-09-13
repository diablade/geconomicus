import {AfterViewInit, Component, Inject, Input} from '@angular/core';
import {Card} from "../../models/game";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {AudioService} from "../../services/audio.service";

@Component({
  selector: 'app-congrats-dialog',
  templateUrl: './congrats-dialog.component.html',
  styleUrls: ['./congrats-dialog.component.scss']
})
export class CongratsDialogComponent implements AfterViewInit {
  @Input() card!: Card;
  @Input() text!: string;
  @Input() modelItem = false;

  constructor(public dialogRef: MatDialogRef<CongratsDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private audioService: AudioService) {
    this.text = data.text;
    this.card = data.card;
	this.modelItem = data.modelItem;
  }

  ngAfterViewInit(): void {
    this.audioService.playSound("gotitem");
  }

	close(){
		this.dialogRef.close();
	}
}

import {AfterViewInit, Component, ElementRef, Inject, Input, ViewChild} from '@angular/core';
import {Card} from "../../models/game";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-congrats-dialog',
  templateUrl: './congrats-dialog.component.html',
  styleUrls: ['./congrats-dialog.component.scss']
})
export class CongratsDialogComponent implements AfterViewInit {
  @Input() card!: Card;
  @Input() text!: string;
  @ViewChild('giftAudio') audioPlayerRef!: ElementRef;

  constructor(public dialogRef: MatDialogRef<CongratsDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.text = data.text;
    this.card = data.card;
  }

  ngAfterViewInit(): void {
    this.audioPlayerRef.nativeElement.play();
  }

	close(){
		this.dialogRef.close();
	}
}

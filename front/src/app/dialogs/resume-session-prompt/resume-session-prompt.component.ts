import { Component, ElementRef, Inject, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LocalStorageService } from 'src/app/services/local-storage/local-storage.service';

@Component({
  selector: 'app-resume-session-prompt',
  templateUrl: './resume-session-dialog.html',
  styleUrls: ['./resume-session-dialog.scss']
})
export class ResumeSessionPromptComponent implements OnInit, AfterViewInit{
  session: any;
  @ViewChild('svg') svg!: ElementRef;

  constructor(private router: Router, private localStorageService: LocalStorageService,
    public dialogRef: MatDialogRef<ResumeSessionPromptComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {
    this.session = this.data;
  }

  ngOnInit(): void {
    if (!this.session || !this.session.idGame || !this.session.idPlayer) {
     this.dismiss();
    }
  }

  ngAfterViewInit(): void {
    this.svg.nativeElement.innerHTML = this.session.player.image; 
  }


  resume() {
    this.router.navigate(['game', this.session.idGame, 'player', this.session.idPlayer]);
    this.dialogRef.close();
  }

  dismiss() {
    this.localStorageService.removeItem("session");
    this.dialogRef.close();
  }
}

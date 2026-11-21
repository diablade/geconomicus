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

  /** Drops the saved entry when it does not point at a v2 avatar seat. */
  ngOnInit(): void {
    if (!this.session?.sessionId || this.session.avatarIdx == null) {
     this.dismiss();
    }
  }

  ngAfterViewInit(): void {
    this.svg.nativeElement.innerHTML = this.session.player.image; 
  }


  /** Sends the player back to their lobby, which rejoins the running game on its own. */
  resume() {
    this.router.navigate(['avatar', this.session.sessionId, this.session.avatarIdx], { queryParams: { resume: 1 } });
    this.dialogRef.close();
  }

  dismiss() {
    this.localStorageService.removeItem("session");
    this.dialogRef.close();
  }
}

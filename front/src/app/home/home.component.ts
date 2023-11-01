import {Component} from '@angular/core';
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {BackService} from "../services/back.service";
import {Router} from "@angular/router";
import {ScannerDialogComponent} from "../dialogs/scanner-dialog/scanner-dialog.component";
import {faCamera} from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  protected readonly faCamera = faCamera;

  constructor(private router: Router, private backService: BackService, public dialog: MatDialog) {
  }


  onCreate() {
    const dialogRef = this.dialog.open(CreateGameDialog, {});

    dialogRef.afterClosed().subscribe(gameName => {
      if (gameName) {
        this.backService.createGame({'gameName': gameName})
          .subscribe(
            game => {
              this.router.navigate(['game', game._id, 'master']);
            },
          );
      }
    });
  }

  join() {
    const dialogRef = this.dialog.open(ScannerDialogComponent, {});
    dialogRef.afterClosed().subscribe(url => {
      window.location.href = url;
    });
  }
}


@Component({
  selector: 'create-game-dialog',
  templateUrl: './../dialogs/create-game-dialog.html',
})
export class CreateGameDialog {
  name: String = "";

  constructor(public dialogRef: MatDialogRef<CreateGameDialog>) {
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}

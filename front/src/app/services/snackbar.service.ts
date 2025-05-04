import {Injectable} from '@angular/core';
import {MatSnackBar, MatSnackBarConfig} from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {

  durationInSeconds = 3000;
  durationInSecondsReload = 7000;

  constructor(private snackBar: MatSnackBar) {
  }

  showSuccess(message: string) {
    const config = new MatSnackBarConfig();
    config.panelClass = ['snackbar-success'];
    config.politeness = 'assertive';
    config.verticalPosition = 'top';
    config.horizontalPosition = 'right';
    config.duration = this.durationInSeconds;
    this.snackBar.open(message, undefined, config);
  }

  showNotif(message: string) {
    const config = new MatSnackBarConfig();
    config.panelClass = ['snackbar-success'];
    config.politeness = 'assertive';
    config.verticalPosition = 'top';
    config.horizontalPosition = 'left';
    config.duration = this.durationInSeconds;
    this.snackBar.open(message, "Ok", config);
  }


  showError(message: string) {
    const config = new MatSnackBarConfig();
    config.panelClass = ['snackbar-error'];
    config.politeness = 'assertive';
    config.verticalPosition = 'top';
    config.horizontalPosition = 'center';
    config.duration = this.durationInSeconds;
    this.snackBar.open(message, undefined, config);
  }
  showReload(message: string) {
    const config = new MatSnackBarConfig();
    config.panelClass = ['snackbar-error'];
    config.politeness = 'assertive';
    config.verticalPosition = 'top';
    config.horizontalPosition = 'center';
    config.duration = this.durationInSecondsReload;
    const snackBarRef = this.snackBar.open(message, "🔄", config);

    snackBarRef.onAction().subscribe(() => {
      window.location.reload();
    });
    
  }
}

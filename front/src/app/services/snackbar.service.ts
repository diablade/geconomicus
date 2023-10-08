import {Injectable} from '@angular/core';
import {MatSnackBar, MatSnackBarConfig} from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {

  durationInSeconds = 3000;

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

  showError(message: string) {
    const config = new MatSnackBarConfig();
    config.panelClass = ['snackbar-error'];
    config.politeness = 'assertive';
    config.verticalPosition = 'top';
    config.horizontalPosition = 'center';
    config.duration = this.durationInSeconds;
    this.snackBar.open(message, undefined, config);
  }
}

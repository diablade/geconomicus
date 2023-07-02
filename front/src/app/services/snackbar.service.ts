import {Injectable} from '@angular/core';
import {MatSnackBar, MatSnackBarConfig} from '@angular/material/snack-bar';
// import {SnackbarComponent} from '../components/snackbar/snackbar.component';
// import {throwError} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {

  durationInSeconds = 5000;

  constructor(private snackBar: MatSnackBar) {
  }

  // tslint:disable-next-line:typedef
  showSuccess(message: string) {
    const config = new MatSnackBarConfig();
    config.panelClass = ['background-green'];
    config.politeness = 'assertive';
    config.verticalPosition = 'top';
    config.duration = this.durationInSeconds;
    this.snackBar.open(message, undefined, config);
  }

  // tslint:disable-next-line:typedef
  showError(message: string) {
    const config = new MatSnackBarConfig();
    config.panelClass = ['background-red'];
    config.politeness = 'assertive';
    config.verticalPosition = 'top';
    config.duration = this.durationInSeconds;
    this.snackBar.open(message, undefined, config);
  }
}

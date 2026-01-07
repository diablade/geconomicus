import { Injectable } from '@angular/core';
import { HttpErrorResponse } from "@angular/common/http";
import { throwError } from "rxjs";
import { SnackbarService } from "./snackbar.service";
import { Router } from "@angular/router";
import { I18nService } from "./i18n.service";

export const REDIRECT_HOME = "redirectHome";
export const NOTIF = "notif";
export const ERROR = "error";
export const ERROR_RELOAD = "errorReload";
export const ERROR_FORCE_RELOAD = "errorForceReload";

@Injectable({
	providedIn: 'root'
})
export class ErrorService {

	constructor(private router: Router, private snackbarService: SnackbarService, private i18nService: I18nService) {
	}

	public handleError(error: HttpErrorResponse, whatToDo: string, whatToSay: string) {
		// Try to get the error message from the response
		const errorMessage = error.error?.message || error.message || whatToSay;

		if (whatToDo == REDIRECT_HOME) {
			this.snackbarService.showNotif(this.i18nService.instant(whatToSay));
			setTimeout(() => {
				// Delay for 3 seconds before proceeding
			}, 3000);
			this.router.navigate([""]);
		} else if (whatToDo == NOTIF) {
			this.snackbarService.showNotif(this.i18nService.instant(whatToSay));
		} else if (whatToDo == ERROR_RELOAD) {
			this.snackbarService.showReload(this.i18nService.instant(whatToSay));
		} else if (whatToDo == ERROR_FORCE_RELOAD) {
			this.snackbarService.showForceReload(this.i18nService.instant(whatToSay));
		} else if (whatToDo == ERROR) {
			this.snackbarService.showError(this.i18nService.instant(whatToSay));
		}
		// Return an observable with a user-facing error message.
		return throwError(() => new Error(this.i18nService.instant("ERROR.GENERIC")));
	}
}

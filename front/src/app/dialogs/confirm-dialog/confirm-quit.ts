import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from './confirm-dialog.component';

/** Asks the user to confirm leaving with a context-specific message key, then goes back to the home page. */
export function confirmQuit(dialog: MatDialog, router: Router, message: string): void {
	dialog
		.open(ConfirmDialogComponent, {
			data: { title: 'DIALOG.QUIT.TITLE', message, labelBtnConfirm: 'QUIT', styleBtnConfirm: 'warn' },
		})
		.afterClosed()
		.subscribe((result) => {
			if (result === 'btnConfirm') router.navigate(['/']);
		});
}

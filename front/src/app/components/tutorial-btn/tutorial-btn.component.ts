import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { I18nService } from '../../services/i18n.service';
import { TutorialDialogComponent } from '../../dialogs/tutorial-dialog/tutorial-dialog.component';

@Component({
	selector: 'app-tutorial-btn',
	templateUrl: './tutorial-btn.component.html',
	styleUrls: ['./tutorial-btn.component.scss'],
})
export class TutorialBtnComponent {
	@Input() labelBtn = 'TUTORIAL.OPEN';
	@Input() icon = true;
	@Input() stroked = false;
	@Input() white = false;

	constructor(
		public dialog: MatDialog,
		private i18n: I18nService
	) {
		this.i18n.loadNamespace('tutorial');
	}

	/** Opens the step-by-step "how to play" tutorial. */
	openTutorial() {
		this.dialog.open(TutorialDialogComponent, {
			data: {},
			maxWidth: '700px',
			width: '95vw',
		});
	}
}

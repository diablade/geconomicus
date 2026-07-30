import { Component, Inject } from '@angular/core';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18nService } from '../../services/i18n.service';
import { SessionService } from '../../services/api/session.service';
import { SESSION_STATUS } from '@geco/shared';
import { AVATAR_CODE_MAX_LENGTH, parseCode } from '../../services/avatarCode';
import Keyboard from 'simple-keyboard';

@Component({
	selector: 'app-join-short-dialog',
	templateUrl: './join-short-dialog.component.html',
	styleUrls: ['./join-short-dialog.component.scss'],
})
export class JoinShortDialogComponent {
	code = '';
	error = '';
	resolving = false;
	faXmark = faXmark;
	keyboard!: Keyboard;

	constructor(
		public dialogRef: MatDialogRef<JoinShortDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any,
		private sessionService: SessionService,
		private i18n: I18nService
	) {
		this.i18n.loadNamespace('join');
	}

	ngAfterViewInit() {
		this.keyboard = new Keyboard({
			onKeyPress: (button) => this.onKeyPress(button),
			layout: {
				default: ['1 2 3', '4 5 6', '7 8 9', '- 0 {bksp}'],
			},
			display: { '{bksp}': '⌫' },
			theme: 'hg-theme-default hg-layout-numeric numeric-theme',
		});
	}

	onKeyPress = (button: string) => {
		this.error = '';
		if (button === '{bksp}') {
			this.code = this.code.slice(0, -1);
		} else if (this.code.length < AVATAR_CODE_MAX_LENGTH) {
			this.code += button;
		}
	};

	clear() {
		this.code = '';
		this.error = '';
	}

	get canSubmit(): boolean {
		return !this.resolving && parseCode(this.code) !== null;
	}

	submit() {
		const parsed = parseCode(this.code);
		if (!parsed) {
			this.error = 'DIALOG_JOIN_SHORT_CODE.INVALID_FORMAT';
			return;
		}
		this.resolving = true;
		this.sessionService.lookupByShortId(parsed.shortId).subscribe({
			next: (session) => {
				this.resolving = false;
				this.dispatch(session, parsed.avatarIdx);
			},
			error: () => {
				this.resolving = false;
				this.error = 'DIALOG_JOIN_SHORT_CODE.UNKNOWN_SESSION';
			},
		});
	}

	private dispatch(session: any, avatarIdx: number | null) {
		if (!session || !session._id) {
			this.error = 'DIALOG_JOIN_SHORT_CODE.UNKNOWN_SESSION';
			return;
		}
		const isOpen = session.status === SESSION_STATUS.OPEN;

		if (avatarIdx !== null) {
			const exists = (session.avatars || []).some((a: any) => a.idx === avatarIdx);
			if (exists) {
				this.dialogRef.close({ commands: ['/avatar', session._id, avatarIdx], queryParams: { resume: 1 } });
				return;
			}
			if (isOpen) {
				this.dialogRef.close({ commands: ['/join', session._id], queryParams: { newAvatar: 1 } });
				return;
			}
			this.error = 'DIALOG_JOIN_SHORT_CODE.UNKNOWN_AVATAR';
			return;
		}

		if (isOpen) {
			this.dialogRef.close({ commands: ['/join', session._id] });
			return;
		}
		this.error = 'DIALOG_JOIN_SHORT_CODE.NEEDS_AVATAR_CODE';
	}
}

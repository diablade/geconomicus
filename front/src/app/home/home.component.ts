import { Component, AfterViewInit, OnInit, OnDestroy, ElementRef, NgZone } from '@angular/core';
import { animate, hover, inView, press, stagger } from 'motion';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { faCamera, faChevronDown, faKeyboard } from '@fortawesome/free-solid-svg-icons';
import { ReJoinQrDialogComponent } from '../dialogs/re-join-qr-dialog/re-join-qr-dialog.component';
import { Platform } from '@angular/cdk/platform';
import { ScannerQrCode } from '../dialogs/scanner-qr-code/scanner-qr-code.component';
import { I18nService } from '../services/i18n.service';
import { ContributionsComponent } from '../components/contributions/contributions.component';
import { JoinShortDialogComponent } from '../dialogs/join-short-dialog/join-short-dialog.component';
import { LocalStorageService } from '../services/local-storage/local-storage.service';
import { ResumeSessionPromptComponent } from '../dialogs/resume-session-prompt/resume-session-prompt.component';
import { AudioService } from '../services/audio.service';
import { ThemesService } from '../services/themes.service';
import { SessionService } from '../services/api/session.service';
import { FullscreenService } from '../services/fullscreen.service';

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
	faCamera = faCamera;
	faChevronDown = faChevronDown;
	faKeyboard = faKeyboard;
	modalPwaEvent: any;
	modalPwaPlatform: string | undefined;
	private stopAnimations: (() => void)[] = [];

	constructor(
		private router: Router,
		private i18nService: I18nService,
		private platform: Platform,
		private sessionService: SessionService,
		private localStorageService: LocalStorageService,
		private audioService: AudioService,
		private fullscreenService: FullscreenService,
		private host: ElementRef<HTMLElement>,
		private zone: NgZone,
		public dialog: MatDialog
	) {
		this.i18nService.loadNamespace('home');
	}

	ngOnInit(): void {
		this.loadModalPwa();
	}

	ngAfterViewInit(): void {
		const session: any = this.localStorageService.getItem('session');
		if (session && session.idGame && session.idPlayer) {
			const dialogRef = this.dialog.open(ResumeSessionPromptComponent, {
				disableClose: true,
				data: session,
			});
			dialogRef.afterClosed().subscribe();
		}
		if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			this.zone.runOutsideAngular(() => this.playIntroAnimations());
		}
	}

	/** Stops every running Motion animation and listener. */
	ngOnDestroy(): void {
		this.stopAnimations.forEach((stop) => stop());
	}

	/** Plays the Motion entrance, scroll-reveal, and hover/press animations of the home page. */
	private playIntroAnimations(): void {
		const root = this.host.nativeElement;
		const reveal = root.querySelectorAll('[data-reveal]');
		const intro = animate(
			reveal,
			{ opacity: [0, 1], y: [40, 0], scale: [0.94, 1] },
			{ type: 'spring', bounce: 0.35, duration: 0.9, delay: stagger(0.15) }
		);
		const logo = animate(
			root.querySelector('.logo-wrap')!,
			{ y: [0, -10, 0], rotate: [0, -1.5, 0] },
			{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }
		);
		const stopInView = inView(
			root.querySelectorAll('[data-in-view]'),
			(element) => {
				animate(element, { opacity: [0, 1], y: [60, 0] }, { type: 'spring', bounce: 0.3, duration: 0.8 });
			},
			{ amount: 0.2 }
		);
		const stopHover = hover(root.querySelectorAll('[data-pop], .geco, .guny, .img-bottom'), (element) => {
			animate(element, { scale: 1.06 }, { type: 'spring', stiffness: 400, damping: 15 });
			return () => animate(element, { scale: 1 }, { type: 'spring', stiffness: 400, damping: 20 });
		});
		const stopPress = press(root.querySelectorAll('[data-pop], .geco, .guny, .img-bottom'), (element) => {
			animate(element, { scale: 0.92 }, { type: 'spring', stiffness: 600, damping: 20 });
			return () => animate(element, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 12 });
		});
		this.stopAnimations = [
			() => intro.stop(),
			() => logo.stop(),
			stopInView,
			stopHover,
			stopPress,
		];
	}

	beep() {
		this.audioService.playSound('coins');
	}

	private fakeTapCount = 0;
	private fakeTapTimer: any = null;
	fakeTap(): void {
		clearTimeout(this.fakeTapTimer);
		this.fakeTapCount++;
		if (this.fakeTapCount >= 5) {
			this.fakeTapCount = 0;
			this.router.navigate(['/fake']);
			return;
		}
		this.fakeTapTimer = setTimeout(() => (this.fakeTapCount = 0), 800);
	}

	create() {
		const dialogRef = this.dialog.open(CreateSessionDialog, {});

		dialogRef.afterClosed().subscribe((data) => {
			if (data?.name) {
				this.sessionService.create(data.name, data.location, data.animator, data.theme).subscribe((session) => {
					this.router.navigate(['session', session._id]);
				});
			}
		});
	}

	contribution() {
		const dialogRef = this.dialog.open(ContributionsComponent, {});
		dialogRef.afterClosed().subscribe();
	}

	joinWithCamera() {
		const dialogRef = this.dialog.open(ScannerQrCode, {});
		dialogRef.afterClosed().subscribe((url) => {
			const u = new URL(url);
			const paths = u.pathname.split('/').filter(Boolean);
			this.router.navigate(paths);
		});
	}

	joinShortId() {
		const dialogRef = this.dialog.open(JoinShortDialogComponent, {});
		dialogRef.afterClosed().subscribe((destination) => {
			if (destination?.commands) {
				this.router.navigate(destination.commands, { queryParams: destination.queryParams });
			}
		});
	}

	openKeyPub() {
		const gunyKeyPub = '4JfewkSqRFpzdJsKnxrSBLgQcjBaopVs9ct4Qc32B8kf:jrw';
		const keyText = this.i18nService.instant('PUBLIC_KEY');
		this.dialog.open(ReJoinQrDialogComponent, {
			data: {
				url: gunyKeyPub,
				text: keyText + gunyKeyPub,
				textSize: '10px',
			},
		});
	}

	loadModalPwa(): void {
		if (this.platform.ANDROID) {
			window.addEventListener('beforeinstallprompt', (event: any) => {
				event.preventDefault();
				this.modalPwaEvent = event;
				this.modalPwaPlatform = 'ANDROID';
			});
		}
		if (this.platform.IOS) {
			const isInStandaloneMode = 'standalone' in window.navigator && (<any>window.navigator)['standalone'];
			if (!isInStandaloneMode) {
				this.modalPwaPlatform = 'IOS';
			}
		}
	}

	installApp() {
		if (this.platform.ANDROID) {
			this.modalPwaEvent.prompt();
		}
		if (this.platform.IOS) {
			this.dialog.open(InstallAppDialog);
		}
	}

	toggleFullscreen() {
		this.fullscreenService.toggle();
	}
}

@Component({
	selector: 'create-session-dialog',
	templateUrl: './create-session-dialog.html',
})
export class CreateSessionDialog {
	name = '';
	animator = '';
	location = '';
	theme = '';
	themes: string[];

	constructor(
		public dialogRef: MatDialogRef<CreateSessionDialog>,
		private themesService: ThemesService,
		private i18nService: I18nService
	) {
		this.themes = this.themesService.getThemesKeys();
		this.theme = this.themes[0];
	}

	onNoClick(): void {
		this.dialogRef.close();
	}
}

@Component({
	selector: 'install-app-dialog',
	templateUrl: './install-app-dialog.html',
})
export class InstallAppDialog {
	constructor(public dialogRef: MatDialogRef<InstallAppDialog>) {}

	onNoClick(): void {
		this.dialogRef.close();
	}
}

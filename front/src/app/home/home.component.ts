import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {BackService} from "../services/back.service";
import {Router} from "@angular/router";
import {faCamera} from "@fortawesome/free-solid-svg-icons";
import {JoinQrDialog} from "../master-board/master-board.component";
import {Platform} from "@angular/cdk/platform";
import {ScannerDialogV3Component} from "../dialogs/scanner-dialog-v3/scanner-dialog-v3.component";
import {I18nService} from "../services/i18n.service";
import {ContributionsComponent} from "../components/contributions/contributions.component";

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
	faCamera = faCamera;
	@ViewChild('coins') coins!: ElementRef;
	modalPwaEvent: any;
	modalPwaPlatform: string | undefined;

	beep() {
		const audio: HTMLAudioElement = this.coins.nativeElement;
		audio.play();
	}

	constructor(private router: Router, private i18nService: I18nService, private platform: Platform, private backService: BackService, public dialog: MatDialog) {
	}

	ngOnInit(): void {
		this.loadModalPwa();
	}


	create() {
		const dialogRef = this.dialog.open(CreateGameDialog, {});

		dialogRef.afterClosed().subscribe(data => {
			if (data.name) {
				this.backService.createGame(data)
					.subscribe(
						game => {
							this.router.navigate(['game', game._id, 'master']);
						},
					);
			}
		});
	}

	contribution() {
		const dialogRef = this.dialog.open(ContributionsComponent, {});
		dialogRef.afterClosed().subscribe();
	}

	join() {
		const dialogRef = this.dialog.open(ScannerDialogV3Component, {});
		dialogRef.afterClosed().subscribe(url => {
			const u = new URL(url);
			const paths = u.pathname.split('/').filter(Boolean);
			this.router.navigate(paths);
		});
	}

	openKeyPub() {
		const gunyKeyPub = "4JfewkSqRFpzdJsKnxrSBLgQcjBaopVs9ct4Qc32B8kf:jrw"
		const keyText = this.i18nService.instant("PUBLIC_KEY");
		this.dialog.open(JoinQrDialog, {
			data: {
				url: gunyKeyPub,
				text: keyText + gunyKeyPub,
				textSize: "10px"
			},
		});
	}

	private loadModalPwa(): void {
		if (this.platform.ANDROID) {
			window.addEventListener('beforeinstallprompt', (event: any) => {
				event.preventDefault();
				this.modalPwaEvent = event;
				this.modalPwaPlatform = 'ANDROID';
			});
		}
		if (this.platform.IOS) {
			const isInStandaloneMode = ('standalone' in window.navigator) && ((<any>window.navigator)['standalone']);
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

}

@Component({
	selector: 'create-game-dialog',
	templateUrl: './../dialogs/create-game-dialog.html',
})
export class CreateGameDialog {
	name = "";
	animator = "";
	location = "";

	constructor(public dialogRef: MatDialogRef<CreateGameDialog>) {
	}

	onNoClick(): void {
		this.dialogRef.close();
	}
}

@Component({
	selector: 'install-app-dialog',
	templateUrl: './../dialogs/install-app-dialog.html',
})
export class InstallAppDialog {
	constructor(public dialogRef: MatDialogRef<InstallAppDialog>) {
	}

	onNoClick(): void {
		this.dialogRef.close();
	}
}

import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {BackService} from "../services/back.service";
import {Router} from "@angular/router";
import {ScannerDialogComponent} from "../dialogs/scanner-dialog/scanner-dialog.component";
import {faCamera} from "@fortawesome/free-solid-svg-icons";
import {JoinQrDialog} from "../master-board/master-board.component";
import {Platform} from "@angular/cdk/platform";

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

	constructor(private router: Router, private platform: Platform, private backService: BackService, public dialog: MatDialog) {
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

	join() {
		const dialogRef = this.dialog.open(ScannerDialogComponent, {});
		dialogRef.afterClosed().subscribe(url => {
			window.location.href = url;
		});
	}

	openKeyPub() {
		const dialogRef = this.dialog.open(JoinQrDialog, {
			data: {
				url: "1RcFajMmNL5m4Gfx2ketJwsssuvYUfFSkRwXu6qoNnf:8Eo",
				text: "Clef public: 1RcFajMmNL5m4Gfx2ketJwsssuvYUfFSkRwXu6qoNnf:8Eo",
				textSize: "10px"
			},
		});
		dialogRef.afterClosed().subscribe(result => {
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
			const dialogRef = this.dialog.open(InstallAppDialog);
		}
	}
}

@Component({
	selector: 'create-game-dialog',
	templateUrl: './../dialogs/create-game-dialog.html',
})
export class CreateGameDialog {
	name: String = "";
	animator: String = "";
	location: String = "";

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

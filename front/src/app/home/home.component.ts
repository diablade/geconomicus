import {Component, ElementRef, ViewChild} from '@angular/core';
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {BackService} from "../services/back.service";
import {Router} from "@angular/router";
import {ScannerDialogComponent} from "../dialogs/scanner-dialog/scanner-dialog.component";
import {faCamera, faQrcode} from "@fortawesome/free-solid-svg-icons";
import {JoinQrDialog} from "../master-board/master-board.component";

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent {
	faCamera = faCamera;
	// faTelegram = faTelegram;
	@ViewChild('coins') coins!: ElementRef;

	beep() {
		const audio: HTMLAudioElement = this.coins.nativeElement;
		audio.play();
	}

	constructor(private router: Router, private backService: BackService, public dialog: MatDialog) {
	}


	onCreate() {
		const dialogRef = this.dialog.open(CreateGameDialog, {});

		dialogRef.afterClosed().subscribe(gameName => {
			if (gameName) {
				this.backService.createGame({'gameName': gameName})
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

	protected readonly faQrcode = faQrcode;

	openKeyPub() {
		const dialogRef = this.dialog.open(JoinQrDialog, {
			data: {
				url: "1RcFajMmNL5m4Gfx2ketJwsssuvYUfFSkRwXu6qoNnf:8Eo",
				text: "Clef public: 1RcFajMmNL5m4Gfx2ketJwsssuvYUfFSkRwXu6qoNnf:8Eo"
			},
		});
		dialogRef.afterClosed().subscribe(result => {
		});
	}
}


@Component({
	selector: 'create-game-dialog',
	templateUrl: './../dialogs/create-game-dialog.html',
})
export class CreateGameDialog {
	name: String = "";

	constructor(public dialogRef: MatDialogRef<CreateGameDialog>) {
	}

	onNoClick(): void {
		this.dialogRef.close();
	}
}

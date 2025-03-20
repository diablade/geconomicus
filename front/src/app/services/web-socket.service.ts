import {Injectable} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import {environment} from '../../environments/environment';
import {SnackbarService} from "./snackbar.service";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {BehaviorSubject} from "rxjs";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {I18nService} from "./i18n.service";
import {HttpClient} from "@angular/common/http";

@Injectable({
	providedIn: 'root'
})
export class WebSocketService {
	private socket: Socket | undefined;
	private ioUrl: string = environment.API_HOST;
	private idGame: string | undefined;
	private idPlayer: string | undefined;
	private disconnected = false;
	private isReConnected = new BehaviorSubject<boolean>(false);

	constructor(
		private snackbarService: SnackbarService,
		public dialog: MatDialog,
		private i18nService: I18nService,
		private http: HttpClient
	) {
		window.addEventListener('offline', () => {
			console.log('Browser is offline');
			this.dialog.closeAll();
			this.disconnected = true;
			this.socket?.disconnect();
			this.dialog.open(InformationDialogComponent, {
				disableClose: true,
				data: {
					title: this.i18nService.instant("SOCKET.OFFLINE.TITLE"),
					disableClose: true,
					text: this.i18nService.instant("SOCKET.OFFLINE.TEXT")
				},
			});
		});

		window.addEventListener('online', () => {
			console.log('Browser is back online');
			this.socket?.connect();
		});
	}

	private connect(idGame: string | undefined, idPlayer: string | undefined): Socket | undefined {
		this.idGame = idGame;
		this.idPlayer = idPlayer;

		if (idGame && idPlayer) {
			this.socket = io(this.ioUrl, {
				query: {
					idPlayer: this.idPlayer,
					idGame: this.idGame,
				},
				ackTimeout: 3000,
				// allowEIO3: true,
				autoConnect: true,
				reconnection: true,           // Enable automatic reconnection
				reconnectionAttempts: 5,      // Number of reconnection attempts
				reconnectionDelay: 1000,      // Delay between reconnections
				reconnectionDelayMax: 3000,   // Maximum delay between reconnections
				timeout: 5000,                // Connection timeout
			});

			this.setupConnectionListeners();
			return this.socket;
		}
		return undefined;
	}

	private setupConnectionListeners(): void {
		if (!this.socket) return;
		this.socket.on("connected", (data: any) => {
			console.log('Connected to the server');
			if (this.disconnected) {
				this.disconnected = false;
				this.dialog.closeAll();
				this.snackbarService.showNotif(this.i18nService.instant("SOCKET.CONNECTED"));
				this.isReConnected.next(true);
			}
		});
		this.socket.on('connect_error', (error) => {
			console.log('Connection failed due to error:', error);
			this.dialog.closeAll();
			this.showDisconnectedDialog();
		});

		this.socket.on("disconnect", (data: any) => {
			console.log('Socket disconnected', data);
			this.disconnected = true;
			this.showReconnectingDialog();
		});
		this.socket.on("reconnecting", (data: any) => {
			console.log('reconnecting...');
		});

		this.socket.on("connect_timeout", (data: any) => {
			console.log('time out');
			this.handleTimeout();
		});

		this.socket.on('reconnect_attempt', (attempt) => {
			console.log('Reconnection attempt:', attempt);
		});

		this.socket.on('reconnect', (attemptNumber) => {
			console.log('Reconnected after', attemptNumber, 'attempts');
		});

		this.socket.on('reconnect_error', () => {
			console.log('Reconnection error');
		});
		this.socket.on('error', () => {
			this.snackbarService.showError("connection ioSocket error...");
			console.log('error');
		});
		this.socket.on('reconnect_failed', () => {
			console.log('Reconnection failed');
		});
	}

	getSocket(idGame: string | undefined, idPlayer: string | undefined): Socket | undefined {
		if (this.socket) {
			return this.socket;
		} else {
			return this.connect(idGame, idPlayer);
		}
	}

	getReConnectionStatus() {
		return this.isReConnected.asObservable();
	}

	private showDisconnectedDialog() {
		this.dialog.open(ConfirmDialogComponent, {
			disableClose: true,
			data: {
				title: this.i18nService.instant("SOCKET.DISCONNECTED.TITLE"),
				message: this.i18nService.instant("SOCKET.DISCONNECTED.MESSAGE"),
				btn1Enable: false,
				labelBtn2: this.i18nService.instant("SOCKET.DISCONNECTED.REFRESH"),
				autoClickBtn2: true,
				timerBtn2: this.i18nService.instant("SOCKET.DISCONNECTED.TIMER"),
			}
		});
	}

	private showReconnectingDialog() {
		this.dialog.open(InformationDialogComponent, {
			data: {
				disableClose: true,
				title: this.i18nService.instant("SOCKET.RECONNECTING.TITLE"),
				text: this.i18nService.instant("SOCKET.RECONNECTING.TEXT")
			},
		});
	}

	private handleTimeout() {
		this.snackbarService.showError(this.i18nService.instant("SOCKET.TIMEOUT"));
	}
}

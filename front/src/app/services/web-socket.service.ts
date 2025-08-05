import {Injectable} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import {environment} from '../../environments/environment';
import {SnackbarService} from "./snackbar.service";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {BehaviorSubject} from "rxjs";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {I18nService} from "./i18n.service";
import {LocalStorageService} from "./local-storage/local-storage.service";

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
		public localStorageService: LocalStorageService,
		private i18nService: I18nService
	) {
		window.addEventListener('offline', () => {
			console.log('Browser is offline');
			this.dialog.closeAll();
			this.disconnected = true;
			this.socket?.disconnect();
			this.socket?.removeAllListeners();
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

		this.socket?.disconnect();
		this.socket?.removeAllListeners();

		this.idGame = idGame;
		this.idPlayer = idPlayer;

		if (idGame && idPlayer) {
			this.socket = io(this.ioUrl, {
				query: {
					idPlayer: this.idPlayer,
					idGame: this.idGame
				},
				ackTimeout: 4000,            // timeout to 4 seconds
				// allowEIO3: true,
				tryAllTransports: true,
				autoConnect: true,
				reconnection: true,       // Enable automatic reconnection
				reconnectionAttempts: 6, // Number of reconnection attempts// Increase attempts
				reconnectionDelay: 1000,  // Delay between reconnections
				reconnectionDelayMax: 2000,  // Maximum delay between reconnections (2s)
				timeout: 6000,               // connection timeout (6s)
				transports: ['websocket'],  // Explicitly set transports
				// forceNew: true     // may not recconnect
			});

			this.setupConnectionListeners();
			return this.socket;
		}
		this.snackbarService.showError("SOCKET UNDEFINED");
		return undefined;
	}

	private setupConnectionListeners(): void {
		if (!this.socket) return;
		const last = this.getLastConnectedTime();
		const now = Date.now();
		const maxOfflineDuration = 100000; // 100 secondes

		this.socket.on('kicked', (data) => {
			console.warn("kicked : " + data.reason);
			this.dialog.open(InformationDialogComponent, {
				data: {
					disableClose: true,
					title: this.i18nService.instant("SOCKET.KICKED.TITLE"),
					text: this.i18nService.instant("SOCKET.KICKED.TEXT") + " " + data.reason
				},
			});
		});
		this.socket.io.on('reconnect', (attemptNumber: number) => {
			console.log('Reconnect after', attemptNumber, 'attempts');
			if (last && now - last > maxOfflineDuration) {
				console.warn('Reconnected after long offline time — reloading page');
				window.location.reload(); // force refresh
			} else {
				console.log('Reconnected — normal flow');
				this.snackbarService.showNotif(this.i18nService.instant("SOCKET.RECONNECTED"));
			}
		});
		this.socket.io.on('ping', () => console.log('ping sent'));
		this.socket.on("connected", (data: any) => {
			console.log('Connected to the server');
			if (this.disconnected) {
				this.disconnected = false;
				this.dialog.closeAll();
				this.snackbarService.showNotif(this.i18nService.instant("SOCKET.CONNECTED"));
				this.isReConnected.next(true);
			}
			this.saveLastConnectedTime();
		});
		this.socket.on('connect_error', (error) => {
			console.log('Connection failed due to error:', error);
			this.dialog.closeAll();
			this.showDisconnectedDialog();
			// this.socket?.io?.reconnection();
		});
		this.socket.on("disconnect", (data: any) => {
			console.log('Socket disconnected', data);
			this.disconnected = true;
			this.showReconnectingDialog();
			//try reconnection
			// this.socket?.io?.reconnection();
		});
		this.socket.on("reconnecting", (data: any) => {
			this.snackbarService.showNotif(this.i18nService.instant("SOCKET.RECONNECTING"));
			console.log('reconnecting...');
		});
		this.socket.on("connect_timeout", (data: any) => {
			console.log('time out');
			this.handleTimeout();
			// this.socket?.io?.reconnection();
		});
		this.socket.on('reconnect_attempt', (attempt) => {
			console.log('Reconnection attempt:', attempt);
		});

		this.socket.on('reconnect_error', () => {
			this.snackbarService.showError(this.i18nService.instant("ERROR.IO_SOCKET_ERROR"));
			console.log('Reconnection error');
		});
		this.socket.on('error', () => {
			this.snackbarService.showError(this.i18nService.instant("ERROR.IO_SOCKET_ERROR"));
			console.log('error');
		});
		this.socket.on('reconnect_failed', () => {
			this.snackbarService.showError(this.i18nService.instant("ERROR.IO_SOCKET_ERROR"));
			console.log('Reconnection failed');
		});
	}

	getSocket(idGame: string | undefined, idPlayer: string | undefined): Socket | undefined {
		if (this.socket && this.socket.connected) {
			this.disconnected = false;
			return this.socket;
		} else {
			let sock = this.connect(idGame, idPlayer);
			if (sock) {
				return sock;
			} else {
				throw Error("WebSocketService: idGame or idPlayer is undefined");
			}
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
		}).afterClosed().subscribe(() => {
			this.socket?.connect();
		});
	}

	private showReconnectingDialog() {
		this.dialog.open(InformationDialogComponent, {
			data: {
				disableClose: true,
				title: this.i18nService.instant("SOCKET.RECONNECTING.TITLE"),
				text: this.i18nService.instant("SOCKET.RECONNECTING.TEXT")
			},
		}).afterClosed().subscribe(() => {
			this.socket?.connect();
		});
	}

	private handleTimeout() {
		this.snackbarService.showError(this.i18nService.instant("SOCKET.TIMEOUT"));
		this.socket?.connect();
	}

	private saveLastConnectedTime(): void {
		this.localStorageService.setItem('lastSocketConnected', Date.now().toString());
	}

	private getLastConnectedTime(): number | null {
		const val = this.localStorageService.getItem('lastSocketConnected');
		return val ? parseInt(val, 10) : null;
	}

}

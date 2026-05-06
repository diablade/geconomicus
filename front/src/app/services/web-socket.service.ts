import {inject, Injectable} from '@angular/core';
import {io, Socket} from 'socket.io-client';
import {environment} from '../../environments/environment';
import {SnackbarService} from "./snackbar.service";
import {InformationDialogComponent} from "../dialogs/information-dialog/information-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {BehaviorSubject} from "rxjs";
import {ConfirmDialogComponent} from "../dialogs/confirm-dialog/confirm-dialog.component";
import {I18nService} from "./i18n.service";
import {LocalStorageService} from "./local-storage/local-storage.service";
import { IO } from '@geco/shared';

@Injectable({
	providedIn: 'root'
})
export class WebSocketService {
	private socket: Socket | undefined;
	private ioUrl: string = environment.API_HOST;
	private disconnected = false;
	private isReConnected = new BehaviorSubject<boolean>(false);
	private currentQuery: any = null;
	private eventHandlers: Map<string, Function[]> = new Map();
	private joinedRooms: Set<string> = new Set();

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
            this.dialog.closeAll();

			this.socket?.connect();
			// Rejoin rooms after a short delay to allow connection to establish
			setTimeout(() => {
                if (this.socket?.connected) {
					console.log('Rejoining rooms after browser came back online:', Array.from(this.joinedRooms));
					this.rejoinAllRooms();
				}
			}, 500);
		});
	}

	private connect(query: any): void {
		this.currentQuery = query;
		this.socket?.disconnect();
		this.socket?.removeAllListeners();

		if (query) {
			this.socket = io(this.ioUrl, {
				query,
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
			this.reattachEventHandlers();
		}
	}

	private reattachEventHandlers(): void {
		if (!this.socket) return;
		this.eventHandlers.forEach((handlers, event) => {
			handlers.forEach(handler => this.socket?.on(event, handler as any));
		});
	}

	private setupConnectionListeners(): void {
		if (!this.socket) return;
		const last = this.getLastConnectedTime();
		const now = Date.now();
		const maxOfflineDuration = 10000; // 10 secondes

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
        this.socket.on(IO.INFO, (data: any) => {
            inject(SnackbarService).showNotif(data.message);
        });
		this.socket.io.on('reconnect', (attemptNumber: number) => {
			console.log('Reconnect after', attemptNumber, 'attempts');
			// Rejoin all previously joined rooms
			console.log('Rejoining rooms after socket reconnect:', Array.from(this.joinedRooms));
            this.dialog.closeAll();
			this.rejoinAllRooms();
			if (last && now - last > maxOfflineDuration) {
				console.warn('Reconnected after long offline time — reloading page');
				window.location.reload(); // force refresh
			} else {
				console.log('Reconnected — normal flow');
				this.snackbarService.showNotif(this.i18nService.instant("SOCKET.RECONNECTED"));
			}
		});
		//this.socket.io.on('ping', () => console.log('ping sent'));
		this.socket.on("connected", (data: any) => {
			console.log('Socket IO acknowledged connection');
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
        this.socket.on('error', (error: any) => {
            this.snackbarService.showError(this.i18nService.instant("ERROR.IO_SOCKET_ERROR"));
            console.error('Socket error:', error);
            if (error && error.message && error.message.includes('timeout')) {
                this.handleTimeout();
            }
        });
		this.socket.on('reconnect_failed', () => {
			this.snackbarService.showError(this.i18nService.instant("ERROR.IO_SOCKET_ERROR"));
			console.log('Reconnection failed');
		});
	}

	initializeSocket(query: any): void {
		// Check if we need to reconnect due to query parameter change
		const queryChanged = this.currentQuery && (
			this.currentQuery.publicChannel !== query.publicChannel ||
			this.currentQuery.privateChannel !== query.privateChannel
		);

		if (this.socket && this.socket.connected && !queryChanged) {
			this.disconnected = false;
			return;
		}

		// If query changed, disconnect old socket first
		if (queryChanged) {
			console.log('Query parameters changed, reconnecting socket');
			this.socket?.disconnect();
			this.socket?.removeAllListeners();
			this.eventHandlers.clear();
			this.joinedRooms.clear();
		}

		this.connect({privateChannel: query.privateChannel, publicChannel: query.publicChannel});
	}

	on(event: string, handler: (...args: any[]) => void): void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, []);
		}
		this.eventHandlers.get(event)!.push(handler);
		this.socket?.on(event, handler as any);
	}

	off<T>(event: string, handler?: (data: T) => void): void {
		if (handler) {
			const handlers = this.eventHandlers.get(event);
			if (handlers) {
				const idx = handlers.indexOf(handler as Function);
				if (idx > -1) handlers.splice(idx, 1);
			}
			this.socket?.off(event, handler as any);
		} else {
			this.eventHandlers.delete(event);
			this.socket?.off(event);
		}
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
		// this.socket?.connect();
		setTimeout(() => {
			// Force a complete page reload
			window.location.reload();
		}, 2000);
	}

	private saveLastConnectedTime(): void {
		this.localStorageService.setItem('lastSocketConnected', Date.now().toString());
	}

	private getLastConnectedTime(): number | null {
		const val = this.localStorageService.getItem('lastSocketConnected');
		return val ? parseInt(val, 10) : null;
	}

    emit(event: string, data?: any, callback?: (response: any) => void): void {
		if (this.socket) {
			this.socket.emit(event, data, callback);
		}
	}

	getReConnectionStatus() {
		return this.isReConnected.asObservable();
	}

	joinRoom(room: string): void {
		if (room) {
			this.joinedRooms.add(room);
			if (this.socket && this.socket.connected) {
				console.log('Joining room:', room);
				this.socket.emit('join', room);
			}
		}
	}

	leaveRoom(room: string): void {
		this.joinedRooms.delete(room);
		if (this.socket && this.socket.connected) {
			this.socket.emit('leave', room);
		}
	}

	private rejoinAllRooms(): void {
		if (this.socket && this.socket.connected) {
			this.joinedRooms.forEach(room => {
				console.log('Auto-rejoining room:', room);
				this.socket!.emit('join', room);
			});
		}
	}

	clearJoinedRooms(): void {
		this.joinedRooms.clear();
	}

	isConnected(): boolean {
		return !!this.socket?.connected;
	}

}

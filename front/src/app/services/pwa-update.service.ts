import {ApplicationRef, Injectable} from '@angular/core';
import {SwUpdate, VersionReadyEvent} from '@angular/service-worker';
import {concat, filter, first, interval, timer} from 'rxjs';
import {SnackbarService} from './snackbar.service';
import {I18nService} from './i18n.service';

@Injectable({
	providedIn: 'root'
})
export class PwaUpdateService {

	private readonly checkIntervalInMs = 15 * 60 * 1000;
	private readonly reloadDelayInMs = 4000;
	private reloadScheduled = false;

	constructor(private swUpdate: SwUpdate, private appRef: ApplicationRef, private snackbarService: SnackbarService, private i18nService: I18nService) {
	}

	init(): void {
		if (!this.swUpdate.isEnabled) {
			return;
		}
		this.watchVersionReady();
		this.watchUnrecoverableState();
		this.scheduleUpdateChecks();
	}

	private watchVersionReady(): void {
		this.swUpdate.versionUpdates.pipe(
			filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
		).subscribe(evt => {
			console.info(`currentVersion=[${evt.currentVersion.hash}] | latestVersion=[${evt.latestVersion.hash}]`);
			this.activateAndReload();
		});
	}

	private watchUnrecoverableState(): void {
		this.swUpdate.unrecoverable.subscribe(evt => {
			console.error(`Service worker unrecoverable: ${evt.reason}`);
			this.snackbarService.showForceReload(this.i18nService.instant('PWA.UNRECOVERABLE'));
		});
	}

	private scheduleUpdateChecks(): void {
		const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable));
		concat(appIsStable$, interval(this.checkIntervalInMs)).subscribe(() => {
			this.swUpdate.checkForUpdate().catch(err => console.error('PWA update check failed', err));
		});
	}

	private activateAndReload(): void {
		if (this.reloadScheduled) {
			return;
		}
		this.reloadScheduled = true;
		this.swUpdate.activateUpdate().then(() => {
			this.snackbarService.showReload(this.i18nService.instant('PWA.NEW_VERSION'));
			timer(this.reloadDelayInMs).subscribe(() => window.location.reload());
		}).catch(err => {
			this.reloadScheduled = false;
			console.error('PWA update activation failed', err);
		});
	}
}

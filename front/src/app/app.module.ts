import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PlayerBoardComponent } from './player-board/player-board.component';
import {
	JoinQrDialog,
	MasterBoardComponent
} from './master-board/master-board.component';
import { CreateGameDialog, HomeComponent, InstallAppDialog } from './home/home.component';
import { AppRoutingModule } from "./app-routing.module";
import { MatRadioModule } from "@angular/material/radio";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule } from "@angular/material/dialog";
import { MatInputModule } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { HTTP_INTERCEPTORS, HttpClientModule, HttpClient } from "@angular/common/http";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { JoinComponent } from './join/join.component';
import { MatIconModule } from "@angular/material/icon";
import { PlayerSettingsComponent } from './player-settings/player-settings.component';
import { NgxColorsModule } from "ngx-colors";
import { CardComponent } from './card/card.component';
import { NgOptimizedImage } from "@angular/common";
import { MatBadgeModule } from "@angular/material/badge";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { LoadingComponent } from './loading/loading.component';
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { HttpRequestInterceptor } from "./services/http-request-interceptor.service";
import { MatSelectModule } from "@angular/material/select";
import { InformationDialogComponent } from "./dialogs/information-dialog/information-dialog.component";
import { ResultsComponent } from './results/results.component';
import { VersionComponent } from './components/version/version.component';
import { EventsComponent } from './events/events.component';
import { NgChartsModule } from 'ng2-charts';
import { GameOptionsDialogComponent } from './dialogs/game-options-dialog/game-options-dialog.component';
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ZXingScannerModule } from "@zxing/ngx-scanner";
import { NgxKjuaComponent } from "./qrcodeTool/ngx-kjua.component";
import 'hammerjs';
import 'chartjs-plugin-zoom';
import { ScannerDialogV3Component } from './dialogs/scanner-dialog-v3/scanner-dialog-v3.component';
import { MatListModule } from "@angular/material/list";
import { MatMenuModule } from "@angular/material/menu";
import { GameDeleteDialog, HistoryGamesComponent } from './history-games/history-games.component';
import { SurveyComponent } from "./survey/survey.component";
import { MatSliderModule } from "@angular/material/slider";
import { BankBoardComponent } from './bank-board/bank-board.component';
import { MatChipsModule } from "@angular/material/chips";
import { ContractDialogComponent } from './dialogs/contract-dialog/contract-dialog.component';
import { CreditComponent } from './credit/credit.component';
import { ConfirmDialogComponent } from './dialogs/confirm-dialog/confirm-dialog.component';
import { BtnTimerAutoClickComponent } from './components/btn-timer-auto-click/btn-timer-auto-click.component';
import { MatExpansionModule } from "@angular/material/expansion";
import { CdkMenuTrigger } from "@angular/cdk/menu";
import { SeizureDialogComponent } from './dialogs/seizure-dialog/seizure-dialog.component';
import { DragDropModule } from "@angular/cdk/drag-drop";
import { CongratsDialogComponent } from './dialogs/congrats-dialog/congrats-dialog.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { LOAD_WASM, NgxScannerQrcodeModule } from "ngx-scanner-qrcode";
import { ShortcodeDialogComponent } from './dialogs/shortcode-dialog/shortcode-dialog.component';
import { MasterAdminComponent } from './master-admin/master-admin.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageBtnComponent } from './components/language-btn/language-btn.component';
import { GameInfosDialog, NoticeBtnComponent } from './components/notice-btn/notice-btn.component';
import { I18nService } from './services/i18n.service';
import { ContributionsComponent } from './components/contributions/contributions.component';

// required for AOT compilation
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
	return new TranslateHttpLoader(http);
}

// Necessary to solve the problem of losing internet connection
LOAD_WASM().subscribe();

@NgModule({
	declarations: [
		AppComponent,
		PlayerBoardComponent,
		MasterBoardComponent,
		HomeComponent,
		JoinComponent,
		PlayerSettingsComponent,
		CardComponent,
		LoadingComponent,
		ResultsComponent,
		VersionComponent,
		EventsComponent,
		CreateGameDialog,
		InstallAppDialog,
		JoinQrDialog,
		GameInfosDialog,
		GameOptionsDialogComponent,
		InformationDialogComponent,
		NgxKjuaComponent,
		ScannerDialogV3Component,
		HistoryGamesComponent,
		SurveyComponent,
		BankBoardComponent,
		ContractDialogComponent,
		CreditComponent,
		ConfirmDialogComponent,
		BtnTimerAutoClickComponent,
		SeizureDialogComponent,
		CongratsDialogComponent,
		ShortcodeDialogComponent,
		GameDeleteDialog,
		MasterAdminComponent,
		LanguageBtnComponent,
		NoticeBtnComponent,
		ContributionsComponent,
	],
	imports: [
		HttpClientModule,
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		MatRadioModule,
		MatButtonModule,
		MatDialogModule,
		MatIconModule,
		MatSnackBarModule,
		MatInputModule,
		FormsModule,
		NgxColorsModule,
		NgOptimizedImage,
		MatBadgeModule,
		MatSlideToggleModule,
		FontAwesomeModule,
		MatProgressSpinnerModule,
		MatSelectModule,
		NgChartsModule,
		MatCheckboxModule,
		MatTooltipModule,
		ZXingScannerModule,
		MatListModule,
		MatMenuModule,
		MatSliderModule,
		MatChipsModule,
		MatExpansionModule,
		CdkMenuTrigger,
		DragDropModule,
		NgxScannerQrcodeModule,
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		ServiceWorkerModule.register('ngsw-worker.js', {
			enabled: !isDevMode(),
			// Register the ServiceWorker as soon as the application is stable
			// or after 30 seconds (whichever comes first).
			registrationStrategy: 'registerWhenStable:30000'
		}),
	],
	providers: [
		{ provide: HTTP_INTERCEPTORS, useClass: HttpRequestInterceptor, multi: true },
		I18nService
	],
	bootstrap: [AppComponent]
})

export class AppModule {
	constructor(private i18nService: I18nService) {
		this.i18nService.setDefaultLang('fr');
	}
}

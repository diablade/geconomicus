import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {PlayerBoardComponent} from './player-board/player-board.component';
import {GameInfosDialog, JoinQrDialog, MasterBoardComponent} from './master-board/master-board.component';
import {CreateGameDialog, HomeComponent} from './home/home.component';
import {AppRoutingModule} from "./app-routing.module";
import {MatRadioModule} from "@angular/material/radio";
import {MatButtonModule} from "@angular/material/button";
import {MatDialogModule} from "@angular/material/dialog";
import {MatInputModule} from "@angular/material/input";
import {FormsModule} from "@angular/forms";
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {ScannerDialogComponent} from './dialogs/scanner-dialog/scanner-dialog.component';
import {JoinComponent} from './join/join.component';
import {MatIconModule} from "@angular/material/icon";
import {PlayerSettingsComponent} from './player-settings/player-settings.component';
import {NgxColorsModule} from "ngx-colors";
import {CardComponent} from './card/card.component';
import {NgOptimizedImage} from "@angular/common";
import {MatBadgeModule} from "@angular/material/badge";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {LoadingComponent} from './loading/loading.component';
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {HttpRequestInterceptor} from "./services/http-request-interceptor.service";
import {MatSelectModule} from "@angular/material/select";
import {InformationDialogComponent} from "./dialogs/information-dialog/information-dialog.component";
import {ResultsComponent} from './results/results.component';
import {VersionComponent} from './version/version.component';
import {EventsComponent} from './events/events.component';
import {NgChartsModule} from 'ng2-charts';
import { GameOptionsDialogComponent } from './dialogs/game-options-dialog/game-options-dialog.component';
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatTooltipModule} from "@angular/material/tooltip";
import {ZXingScannerModule} from "@zxing/ngx-scanner";
import {NgxKjuaComponent} from "./qrcodeTool/ngx-kjua.component";
import 'hammerjs';
import 'chartjs-plugin-zoom';
import {
  AppInfoDialogComponent,
  ScannerDialogV2Component
} from './dialogs/scanner-dialog-v2/scanner-dialog-v2.component';
import {MatListModule} from "@angular/material/list";
import {MatMenuModule} from "@angular/material/menu";

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
    ScannerDialogComponent,
    JoinQrDialog,
    GameInfosDialog,
    GameOptionsDialogComponent,
    InformationDialogComponent,
    NgxKjuaComponent,
    ScannerDialogV2Component,
    AppInfoDialogComponent,
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
  ],
  providers: [
    {provide: HTTP_INTERCEPTORS, useClass: HttpRequestInterceptor, multi: true}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}

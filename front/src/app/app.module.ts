import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {PlayerBoardComponent} from './player-board/player-board.component';
import {JoinQrDialog, MasterBoardComponent} from './master-board/master-board.component';
import {CreateGameDialog, HomeComponent} from './home/home.component';
import {AppRoutingModule} from "./app-routing.module";
import {MatRadioModule} from "@angular/material/radio";
import {MatButtonModule} from "@angular/material/button";
import {MatDialogModule} from "@angular/material/dialog";
import {MatInputModule} from "@angular/material/input";
import {FormsModule} from "@angular/forms";
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {ScannerDialogComponent} from './scanner-dialog/scanner-dialog.component';
import {JoinComponent} from './join/join.component';
import {MatIconModule} from "@angular/material/icon";
import {PlayerSettingsComponent} from './player-settings/player-settings.component';
import {NgxColorsModule} from "ngx-colors";
import {CardComponent} from './card/card.component';
import {NgOptimizedImage} from "@angular/common";
import {MatBadgeModule} from "@angular/material/badge";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {QRCodeModule} from "angularx-qrcode";
import {LoadingComponent} from './loading/loading.component';
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {HttpRequestInterceptor} from "./services/http-request-interceptor.service";
import {MatSelectModule} from "@angular/material/select";
import {InformationDialogComponent} from "./information-dialog/information-dialog.component";
import { ResultsComponent } from './results/results.component';
import { VersionComponent } from './version/version.component';
import { EventsComponent } from './events/events.component';

@NgModule({
  declarations: [
    AppComponent,
    PlayerBoardComponent,
    MasterBoardComponent,
    HomeComponent,
    CreateGameDialog,
    ScannerDialogComponent,
    JoinComponent,
    PlayerSettingsComponent,
    CardComponent,
    LoadingComponent,
    JoinQrDialog,
    InformationDialogComponent,
    ResultsComponent,
    VersionComponent,
    EventsComponent,
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
    QRCodeModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  providers: [
    {provide: HTTP_INTERCEPTORS, useClass: HttpRequestInterceptor, multi: true}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}

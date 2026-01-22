import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {PlayerBoardComponent} from './player-board/player-board.component';
import {MasterBoardComponent} from './master-board/master-board.component';
import {HomeComponent} from "./home/home.component";
import {JoinComponent} from "./join/join.component";
import {PlayerSettingsComponent} from "./player-settings/player-settings.component";
import {ResultsComponent} from "./results/results.component";
import {HistoryGamesComponent} from "./history-games/history-games.component";
import {SurveyComponent} from "./survey/survey.component";
import {BankBoardComponent} from "./bank-board/bank-board.component";
import {MasterAdminComponent} from "./master-admin/master-admin.component";
import {ModuleGalileoComponent} from "./components/module-galileo/module-galileo.component";
import {ModuleWealthDistribComponent} from "./components/module-wealth-distrib/module-wealth-distrib.component";
import {LobbyMasterComponent} from "./lobby-master/lobby-master.component";
import {LobbyPlayerComponent} from "./lobby-player/lobby-player.component";

const routes: Routes = [
	{path: '', component: HomeComponent},
	{path: 'history', component: HistoryGamesComponent},
	{path: 'results/:sessionId', component: ResultsComponent},
	{path: 'session/:sessionId', component: LobbyMasterComponent},
	{path: 'join/:sessionId', component: JoinComponent},
	{path: 'avatar/:sessionId/:avatarId', component: LobbyPlayerComponent},
	{path: 'avatar/:sessionId/:avatarId/settings', component: PlayerSettingsComponent},
	{path: 'survey/:sessionId/:gameStateId/:avatarId', component: SurveyComponent},
	{path: 'game/:gameStateId', component: MasterAdminComponent},
	{path: 'game/:gameStateId/admin', component: MasterAdminComponent},
	{path: 'play/:gameStateId/:playerLifeId', component: PlayerBoardComponent},
	{path: 'module/galileo', component: ModuleGalileoComponent},
	{path: 'module/gini', component: ModuleWealthDistribComponent},
	//deprecated routes below
	{path: 'ogame/:idGame/admin', component: MasterAdminComponent},
	{path: 'ogame/:idGame/master', component: MasterBoardComponent},
	{path: 'ogame/:idGame/reset', component: MasterBoardComponent},
	{path: 'ogame/:idGame/bank', component: BankBoardComponent},
	{path: 'ogame/:idGame/join/:fromId/:name', component: JoinComponent},
	{path: 'ogame/:idGame/join', component: JoinComponent},
	{path: 'ogame/:idGame/results', component: ResultsComponent},
	{path: 'ogame/:idGame/player/:idPlayer', component: PlayerBoardComponent},
	{path: 'ogame/:idGame/player/:idPlayer/settings', component: PlayerSettingsComponent},
	{path: '**', redirectTo: '/'},
];

@NgModule({
	imports: [RouterModule.forRoot(routes)],
	exports: [RouterModule]
})
export class AppRoutingModule {
}

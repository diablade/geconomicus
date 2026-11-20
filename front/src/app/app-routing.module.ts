import { inject, NgModule } from '@angular/core';
import { CanDeactivateFn, Routes, RouterModule, Router } from '@angular/router';
import { PlayerBoardComponent } from './player-board/player-board.component';
import { MasterBoardComponent } from './master-board/master-board.component';
import { HomeComponent } from './home/home.component';
import { JoinComponent } from './join/join.component';
import { AvatarSettingsComponent } from './avatar-settings/avatar-settings.component';
import { ResultsComponent } from './results/results.component';
import { HistoryGamesComponent } from './history-games/history-games.component';
import { SurveyComponent } from './survey/survey.component';
import { MasterAdminComponent } from './master-admin/master-admin.component';
import { ModuleGalileoComponent } from './components/module-galileo/module-galileo.component';
import { ModuleWealthDistribComponent } from './components/module-wealth-distrib/module-wealth-distrib.component';
import { ModuleFiscaliteComponent } from './components/module-fiscalite/module-fiscalite.component';
import { LobbyMasterComponent } from './lobby-master/lobby-master.component';
import { LobbyPlayerComponent } from './lobby-player/lobby-player.component';
import { TableBoardComponent } from './table-board/table-board.component';
import { SessionResultsCompareComponent } from './session-results-compare/session-results-compare.component';
import { ToolsComponent } from './tools/tools.component';

/** Refuses browser back/forward (swipe gesture, hardware back button) on player and animator pages, so navigation only follows the app's own buttons. */
const blockBrowserHistory: CanDeactivateFn<unknown> = () => inject(Router).getCurrentNavigation()?.trigger !== 'popstate';

const routes: Routes = [
	{ path: '', component: HomeComponent },
	{ path: 'history', component: HistoryGamesComponent, title: 'TAB_TITLE.HISTORY' },
	{ path: 'session/:sessionId', component: LobbyMasterComponent, title: 'TAB_TITLE.LOBBY_MASTER', canDeactivate: [blockBrowserHistory] },
	{ path: 'join/:sessionId', component: JoinComponent, title: 'TAB_TITLE.JOIN' },
	{ path: 'avatar/:sessionId/:avatarIdx', component: LobbyPlayerComponent, data: { avatarTitle: true }, canDeactivate: [blockBrowserHistory] },
	{ path: 'avatar/:sessionId/:avatarIdx/settings', component: AvatarSettingsComponent, data: { avatarTitle: true }, canDeactivate: [blockBrowserHistory] },
	{ path: 'player/:sessionId/:avatarIdx/:gameStateId/:playerStateIdx', component: PlayerBoardComponent, data: { avatarTitle: true }, canDeactivate: [blockBrowserHistory] },
	{ path: 'fake', component: PlayerBoardComponent, data: { fake: true, avatarTitle: true } },
	{ path: 'survey/:sessionId/:gameStateId/:avatarIdx/:edit', component: SurveyComponent, title: 'TAB_TITLE.SURVEY', canDeactivate: [blockBrowserHistory] },
	{ path: 'master/:sessionId/:gameStateId', component: MasterBoardComponent, title: 'TAB_TITLE.GAME_MASTER', canDeactivate: [blockBrowserHistory] },
	{ path: 'table/:sessionId/:gameStateId', component: TableBoardComponent, title: 'TAB_TITLE.COCKPIT', canDeactivate: [blockBrowserHistory] },
	{ path: 'results/:sessionId', component: SessionResultsCompareComponent, title: 'TAB_TITLE.RESULTS' },
	{ path: 'tools', component: ToolsComponent, title: 'TAB_TITLE.TOOLS' },
	{ path: 'module/galileo', component: ModuleGalileoComponent, title: 'TAB_TITLE.GALILEO' },
	{ path: 'module/gini', component: ModuleWealthDistribComponent, title: 'TAB_TITLE.GINI' },
	{ path: 'module/fiscalite', component: ModuleFiscaliteComponent, title: 'TAB_TITLE.FISCALITE' },
	//deprecated routes below
	{ path: 'ogame/:idGame/admin', component: MasterAdminComponent },
	{ path: 'ogame/:idGame/master', component: MasterBoardComponent },
	{ path: 'ogame/:idGame/reset', component: MasterBoardComponent },
	{ path: 'ogame/:idGame/join/:fromId/:name', component: JoinComponent },
	{ path: 'ogame/:idGame/join', component: JoinComponent },
	{ path: 'ogame/:idGame/results', component: ResultsComponent },
	{ path: 'ogame/:idGame/player/:idPlayer', component: PlayerBoardComponent },
	{ path: 'ogame/:idGame/player/:idPlayer/settings', component: AvatarSettingsComponent },
	{ path: '**', redirectTo: '/' },
];

@NgModule({
	imports: [RouterModule.forRoot(routes, { canceledNavigationResolution: 'computed' })],
	exports: [RouterModule],
})
export class AppRoutingModule {}

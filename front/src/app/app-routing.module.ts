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

const routes: Routes = [
    {path: '', component: HomeComponent},
    {path: 'results/:idGame', component: ResultsComponent},
    {path: 'games', component: HistoryGamesComponent},
    {path: 'game/:idGame/admin', component: MasterAdminComponent},
    {path: 'game/:idGame/master', component: MasterBoardComponent},
    {path: 'game/:idGame/reset', component: MasterBoardComponent},
    {path: 'game/:idGame/bank', component: BankBoardComponent},
    {path: 'game/:idGame/join/:fromId/:name', component: JoinComponent},
    {path: 'game/:idGame/join', component: JoinComponent},
    {path: 'game/:idGame/results', component: ResultsComponent},
    {path: 'game/:idGame/player/:idPlayer', component: PlayerBoardComponent},
    {path: 'game/:idGame/player/:idPlayer/survey', component: SurveyComponent},
    {path: 'game/:idGame/player/:idPlayer/settings', component: PlayerSettingsComponent},
    {path: 'module/galileo', component: ModuleGalileoComponent},
    {path: 'module/gini', component: ModuleWealthDistribComponent},
    {path: '**', redirectTo: '/'},
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {
}

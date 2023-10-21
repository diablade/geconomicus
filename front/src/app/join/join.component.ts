import { Component } from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import {MatDialog} from "@angular/material/dialog";
import {Subscription} from "rxjs";

@Component({
  selector: 'app-join',
  templateUrl: './join.component.html',
  styleUrls: ['./join.component.scss']
})
export class JoinComponent {
  idGame: string="";
  resurrection=false;
  name: string="";
  private subscription: Subscription | undefined;
  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService) {
  }
  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.resurrection = params['r'];
    });
  }
  //To prevent memory leak
  ngOnDestroy(): void {
    if (this.subscription)
      this.subscription.unsubscribe()
  }

  join() {
      this.backService.join(this.idGame,this.name).subscribe(playerId => {
        this.router.navigate(['game', this.idGame, 'player',playerId,'settings']);
      });

  }
}

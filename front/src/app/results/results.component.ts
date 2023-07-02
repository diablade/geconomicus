import { Component } from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {LocalStorageService} from "../services/local-storage/local-storage.service";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {DomSanitizer} from "@angular/platform-browser";
import {MatDialog} from "@angular/material/dialog";
import io from "socket.io-client";
import {Game} from "../models/game";

@Component({
  selector: 'app-results',
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.scss']
})
export class ResultsComponent {
  private subscription: Subscription | undefined;
  idGame: string = "";
  public game: Game = new Game;

  constructor(private route: ActivatedRoute,
              private backService: BackService,
              private snackbarService: SnackbarService,
              private router: Router,
              private sanitizer: DomSanitizer) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
    });
    this.backService.getGame(this.idGame).subscribe(game => {
      this.game = game;
    });
  }
}

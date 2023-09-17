import {AfterViewInit, Component, OnInit} from '@angular/core';
import io from "socket.io-client";
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import {SnackbarService} from "../services/snackbar.service";
import {LoadingService} from "../services/loading.service";
import {environment} from "../../environments/environment";
import {EventGeco} from "../models/game";
import {Subscription} from "rxjs";
// @ts-ignore
import {EVENT} from "../../../../config/constantes";

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss']
})
export class EventsComponent implements OnInit, AfterViewInit {
  private socket: any;
  idGame: string = "";
  private subscription: Subscription | undefined;

  events: EventGeco[] = [];

  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService, private snackbarService: SnackbarService, private loadingService: LoadingService) {
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.backService.getEvents(this.idGame).subscribe(events => {
        this.events = events;
      });
      this.socket = io(environment.API_HOST, {
        query: {
          idPlayer: "master",
          idGame: this.idGame,
        },
      });
    });
  }

  ngAfterViewInit() {
    this.socket.on(EVENT, async (data: any) => {
      console.log(EVENT, data);
      this.events.push(data)
    });
  }
}

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {faCircleInfo, faCommentsDollar, faHourglassEnd, faSackDollar} from "@fortawesome/free-solid-svg-icons";
import {Credit} from "../models/game";
import {BackService} from "../services/back.service";

@Component({
  selector: 'app-credit-contract',
  templateUrl: './credit-contract.component.html',
  styleUrls: ['./credit-contract.component.scss']
})
export class CreditContractComponent {

	protected readonly faCircleInfo = faCircleInfo;
  protected readonly faCommentsDollar = faCommentsDollar;
  protected readonly faHourglassEnd = faHourglassEnd;
  faSackDollar = faSackDollar;
  @Input() credit!: Credit;
  @Input() contractor!: string | undefined;
  @Output() settlement= new EventEmitter<void>();
  interestMinutes= 5;
  @Input() bankOption= false;

  constructor(backService : BackService) {
  }
  terminate() {
    this.settlement.emit();
  }

  getStatus(status: string) {
    switch (status) {
      case "paused" : return "Jeu en pause...";
      case "running" : return "En cours...";
      case "requesting" : return  "Prolonger ?";
      case "warning" : return  "Défaut de paiement";
      case "closed" : return "Terminé";
      default : return "error";
    }
  }

  seizure() {

  }

  answer() {

  }

}

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {faCircleInfo, faCommentsDollar, faHourglassEnd, faSackDollar} from "@fortawesome/free-solid-svg-icons";
import {Credit} from "../models/game";

// @ts-ignore
import * as C from "../../../../config/constantes";

@Component({
  selector: 'app-credit-contract',
  templateUrl: './credit-contract.component.html',
  styleUrls: ['./credit-contract.component.scss']
})
export class CreditContractComponent {

  faCircleInfo = faCircleInfo;
  faHourglassEnd = faHourglassEnd;
  faSackDollar = faSackDollar;
  faCommentsDollar = faCommentsDollar;

  @Input() credit!: Credit;
  @Input() contractor!: string | undefined;
  @Input() interestMinutes = 5;
  @Input() bankOption = false;
  @Output() settlement = new EventEmitter<void>();

  C = C;

  constructor() {
  }

  terminate() {
    this.settlement.emit();
  }

  getStatus(status: string) {
    switch (status) {
      case C.PAUSED_CREDIT :
        return "Jeu en pause...";
      case C.RUNNING_CREDIT :
        return "En cours...";
      case C.REQUEST_CREDIT :
        return "Prolonger ?";
      case C.DEFAULT_CREDIT :
        return "Défaut de paiement";
      case C.CREDIT_DONE :
        return "Terminé";
      default :
        return "error";
    }
  }

  seizure() {

  }

  answer() {

  }

}

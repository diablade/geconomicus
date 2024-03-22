import {Component, EventEmitter, Input, Output} from '@angular/core';
import {faCircleInfo, faSackDollar} from "@fortawesome/free-solid-svg-icons";
import {Credit} from "../models/game";
import {BackService} from "../services/back.service";

@Component({
  selector: 'app-credit-contract',
  templateUrl: './credit-contract.component.html',
  styleUrls: ['./credit-contract.component.scss']
})
export class CreditContractComponent {

	protected readonly faCircleInfo = faCircleInfo;
  @Input() credit!: Credit;
  @Input() contractor!: string | undefined;
  @Output() settlement= new EventEmitter<void>();
  faSackDollar = faSackDollar;
  interestMinutes= 5;
  @Input() bankOption= false;

  constructor(backService : BackService) {
  }
  terminate() {
    this.settlement.emit();
  }

  getStatus(status: string) {
    switch (status) {
      case "running" : return "En cours";
      case "warning" : return  "defaut de paiment";
      case "closed" : return "Terminé";
      default : return "error";
    }
  }

  seizure() {

  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Receipe } from '../models/receipes';
import { Card } from '../models/game';
import { getAvailableReceipes } from '../models/receipes';

@Component({
  selector: 'app-receipes',
  templateUrl: './receipes.component.html',
  styleUrls: ['./receipes.component.scss']
})
export class ReceipesComponent {

  @Input() items: Card[] = [];
  @Input() productionCards: number = 4;
  @Output() onReceipeCompleted: EventEmitter<Receipe> = new EventEmitter<Receipe>();
  receipes: Receipe[] = [];
  screenWidth: number = 0;
  screenHeight: number = 0;

  constructor() {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }

  ngOnInit(): void {
    this.receipes = getAvailableReceipes(this.items, this.productionCards);
  }

  receipeCompleted(receipe: Receipe) {
    this.onReceipeCompleted.emit(receipe);
  }
}

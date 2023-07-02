export class Player {
  name: string = "";
  _id: string = "";
  image: string = "";
  coins: number = 0;
  credits: Credit[] = [];
  cards: Card[] = [];
  eye: number = 3;
  earrings: number = 0;
  eyebrows: number = 0;
  features: number = 0;
  hair: number = 3;
  glasses: number = 0;
  mouth: number = 14;
  earringsProbability: number = 100;
  glassesProbability: number = 100;
  featuresProbability: number = 100;
  skinColor: string = "#ECAD80";
  hairColor: string = "#3EAC2C";
  status: string = "";
}

export class Card {
  _id: string = "";
  color: string = "";
  weight: number = 0;
  price: number = 0;
  letter: string = "";

  displayed: boolean = true;
  count: number = 1;
}

export class Credit {
  amount: number = 0;
  interest: number = 0;
}

export class Game {
  _id: string = "";
  status: string = "";
  name: string = "";
  typeMoney: string = "";
  players: Player[] = [];
  decks: Card[][] = [[]];
  priceWeight1: number = 1;
  priceWeight2: number = 3;
  priceWeight3: number = 6;
  priceWeight4: number = 9;
  round: number = 0;
  roundMax: number = 10;
  roundMinutes: number = 5;
  // @ts-ignore
  modified: Date = Date.now();
  // @ts-ignore
  created: Date = Date.now();
}

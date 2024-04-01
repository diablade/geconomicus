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
  _id: string = "";
  idPlayer: string = "";
  idGame: string = "";
  amount: number = 0;
  interest: number = 0;
  extended: number = 0;
  status: string = "created"
  // created,paused,running,requesting,settled
  progress: number = 0;
  // @ts-ignore
  createDate: Date = undefined;
  // @ts-ignore
  startDate: Date = undefined;
  // @ts-ignore
  endDate: Date = undefined;
}

export class Feedback {
  depressedHappy: number = 0;
  individualCollective: number = 0;
  aloneIntegrated: number = 0;
  greedyGenerous: number = 0;
  competitiveCooperative: number = 0;
  anxiousConfident: number = 0;
  agressiveAvenant: number = 0;
  irritableTolerant: number = 0;
  dependantAutonomous: number = 0;
}

export class EventGeco {
  typeEvent: string = "";
  emitter: string = "";
  receiver: string = "";
  amount: number = 0;
  resources: Card[] = [];
  // @ts-ignore
  date: Date = Date.now();
}

export class Player {
  name: string = "";
  _id: string = "";
  image: string = "";
  coins: number = 0;
  cards: Card[] = [];
  survey: Feedback | undefined;
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
  boardConf: string = "wood";
  boardColor: string = "";
  status: string = "alive";
}

export class Game {
  _id: string = "";
  status: string = "";
  name: string = "";
  typeMoney: string = "june";
  players: Player[] = [];
  decks: Card[][] = [[]];
  events: EventGeco[] = [];

  //option general
  priceWeight1: number = 3;
  priceWeight2: number = 6;
  priceWeight3: number = 9;
  priceWeight4: number = 12;
  currentMassMonetary: number = 0;
  amountCardsForProd: number = 4;
  generatedIdenticalCards: number = 4;
  surveyEnabled: boolean = true;
  round: number = 0;
  roundMax: number = 10;
  roundMinutes: number = 8;

  //option june
  currentDU: number = 0;
  inequalityStart: boolean = false;
  tauxCroissance: number = 5;
  startAmountCoins: number = 5;
  pctPoor: number = 10;
  pctRich: number = 10;

  //option debt
  credits: Credit[] = [];
  bankInterestEarned = 0;
  defaultCreditAmount: number = 3;
  defaultInterestAmount: number = 1;
  timerCredit: number = 5;
  timerPrison: number = 5;
  manualBank: boolean = true;
  seizureType: string = "decote";
  seizureCosts: number = 2;
  seizureDecote: number = 25;

  // @ts-ignore
  modified: Date = Date.now();
  // @ts-ignore
  created: Date = Date.now();
}

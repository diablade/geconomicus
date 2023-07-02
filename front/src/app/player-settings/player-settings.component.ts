import {createAvatar, Options as Opt, schema} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {Player} from "../models/game";
import {BackService} from "../services/back.service";
import {DomSanitizer} from "@angular/platform-browser";
import {faChevronLeft, faChevronRight, faShuffle} from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: 'app-player-settings',
  templateUrl: './player-settings.component.html',
  styleUrls: ['./player-settings.component.scss']
})
export class PlayerSettingsComponent implements OnInit {
  @ViewChild('svgContainer') svgContainer!: ElementRef;
  idGame: string | undefined;
  idPlayer: string | undefined;
  player: Player = new Player();
  private subscription: Subscription | undefined;
  options: Partial<adventurer.Options & Opt> = {};
  skin: string = "#f2d3b1";
  hairColor: string = "#ac6511";
  properties: any = {
    ...schema.properties,
    ...adventurer.schema.properties,
  };
  skinPalette: Array<any> = ['#f2d3b1', '#ecad80', '#9e5622', '#763900'];
  hairPalette: Array<any> = ['#ac6511', '#cb6820', '#ab2a18', '#e5d7a3', '#b9a05f', '#796a45', '#6a4e35', '#562306', '#0e0e0e', '#afafaf', '#3eac2c', '#85c2c6', '#dba3be', '#592454'];

  constructor(private route: ActivatedRoute, private router: Router, private backService: BackService, private sanitizer: DomSanitizer) {
    // @ts-ignore
    console.log(adventurer.schema.properties);
  }

  ngOnInit(): void {
    this.subscription = this.route.params.subscribe(params => {
      this.idGame = params['idGame'];
      this.idPlayer = params['idPlayer'];
      this.backService.getPlayer(this.idGame, this.idPlayer).subscribe(player => {
        this.player = player;
        if (this.player.image === "" || this.player.image === undefined) {
          this.randomize();
        } else {
          this.skin = "#" + this.player.skinColor;
          this.hairColor = "#" + this.player.hairColor;
          // @ts-ignore
          this.svgContainer.nativeElement.innerHTML = this.player.image;
        }
      });
    });
  }

  changeEyes(increment: boolean) {
    if (increment && this.player.eye < this.properties.eyes.default.length - 1) {
      this.player.eye++;
    } else if (!increment && this.player.eye > 0) {
      this.player.eye--;
    }
    this.updateSvg();
  }

  changeEarrings(increment: boolean) {
    if (increment && this.player.earrings < this.properties.earrings.default.length - 1) {
      this.player.earrings++;
    } else if (!increment && this.player.earrings > -1) {
      this.player.earrings--;
    }
    this.updateSvg();
  }

  changeEyeBrows(increment: boolean) {
    if (increment && this.player.eyebrows < this.properties.eyebrows.default.length - 1) {
      this.player.eyebrows++;
    } else if (!increment && this.player.eyebrows > 0) {
      this.player.eyebrows--;
    }
    this.updateSvg();
  }

  changeFeature(increment: boolean) {
    if (increment && this.player.features < this.properties.features.default.length - 1) {
      this.player.features++;
    } else if (!increment && this.player.features > -1) {
      this.player.features--;
    }
    this.updateSvg();
  }

  changeHair(increment: boolean) {
    if (increment && this.player.hair < this.properties.hair.default.length - 1) {
      this.player.hair++;
    } else if (!increment && this.player.hair > 0) {
      this.player.hair--;
    }
    this.updateSvg();
  }

  changeGlasses(increment: boolean) {
    if (increment && this.player.glasses < this.properties.glasses.default.length - 1) {
      this.player.glasses++;
    } else if (!increment && this.player.glasses > -1) {
      this.player.glasses--;
    }
    this.updateSvg();
  }

  changeMouth(increment: boolean) {
    if (increment && this.player.mouth < this.properties.mouth.default.length - 1) {
      this.player.mouth++;
    } else if (!increment && this.player.mouth > 0) {
      this.player.mouth--;
    }
    this.updateSvg();
  }

  changeSkin() {
    this.player.skinColor = this.skin.replace("#", "");
    this.updateSvg();
  }

  changeHairColor() {
    this.player.hairColor = this.hairColor.replace("#", "");
    this.updateSvg();
  }

  updateSvg() {
    this.options.hairColor = [this.player.hairColor];
    this.options.skinColor = [this.player.skinColor];
    this.options.mouth = [this.properties.mouth.default[this.player.mouth]];
    this.options.hair = [this.properties.hair.default[this.player.hair]];
    this.options.eyebrows = [this.properties.eyebrows.default[this.player.eyebrows]];
    this.options.eyes = [this.properties.eyes.default[this.player.eye]];
    this.options.earrings = [this.properties.earrings.default[this.player.earrings]];
    this.options.glasses = [this.properties.glasses.default[this.player.glasses]];
    this.options.features = [this.properties.features.default[this.player.features]];
    this.options.glassesProbability = 100;
    this.options.featuresProbability = 100;
    this.options.earringsProbability = 100;
    this.options.hairProbability = 100;
    this.player.image = createAvatar(adventurer, this.options).toString();
    this.svgContainer.nativeElement.innerHTML = this.player.image;
  }

  close() {
    this.router.navigate(["game", this.idGame, "player", this.idPlayer]);
  }

  saveAndClose() {
    this.backService.updatePlayer(this.idGame, this.player).subscribe(res => {
      this.close();
    });
  }

  //To prevent memory leak
  ngOnDestroy(): void {
    if (this.subscription)
      this.subscription.unsubscribe()
  }

  getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  randomize() {
    this.player.eye = this.getRandomInt(1, this.properties.eyes.default.length);
    this.player.earrings = this.getRandomInt(0, this.properties.earrings.default.length);
    this.player.eyebrows = this.getRandomInt(1, this.properties.eyebrows.default.length);
    this.player.features = this.getRandomInt(1, this.properties.features.default.length);
    this.player.hair = this.getRandomInt(1, this.properties.hair.default.length);
    this.player.glasses = this.getRandomInt(1, this.properties.glasses.default.length);
    this.player.mouth = this.getRandomInt(1, this.properties.mouth.default.length);
    this.hairColor = this.hairPalette[this.getRandomInt(0, 13)];
    this.skin = this.skinPalette[this.getRandomInt(0, 3)];
    this.player.skinColor = this.skin.replace("#", "");
    this.player.hairColor = this.hairColor.replace("#", "");
    this.updateSvg();
  }

  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;
  backgroundColor: any;

  changeBackground() {

  }

  protected readonly faShuffle = faShuffle;
}

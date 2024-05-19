import {Component} from '@angular/core';
import * as conf from './../../../../package.json';

@Component({
  selector: 'app-version',
  templateUrl: './version.component.html',
  styleUrls: ['./version.component.scss']
})
export class VersionComponent {
  version = "";

  constructor() {
    const intermediateJson = conf;
    this.version = intermediateJson.version;
  }
}

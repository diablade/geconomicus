import {Component, OnInit} from '@angular/core';
import {LoadingService} from "../services/loading.service";
import {delay} from "rxjs";

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss']
})
export class LoadingComponent implements OnInit{
  show = false;

  constructor(private loadingService: LoadingService) {
  }

  ngOnInit() {
    this.listenToLoading();
  }

  /**
   * Listen to the loadingSub property in the LoadingService class. This drives the
   * display of the loading spinner.
   */
  listenToLoading(): void {
    this.loadingService.isLoading
      .pipe(delay(0)) // This prevents a ExpressionChangedAfterItHasBeenCheckedError for subsequent requests
      .subscribe((loading) => {
        this.show = loading;
      });
  }

}

import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import {Observable} from 'rxjs';
import {finalize} from 'rxjs/operators'
import {Injectable} from '@angular/core';
import {LoadingService} from '../services/loading.service';

@Injectable({
  providedIn: 'root'
})
export class HttpRequestInterceptor implements HttpInterceptor {

  private queries = 0;

  constructor(private loadingService: LoadingService) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.queries++;

    this.loadingService.show();

    return next.handle(req)
      .pipe(
        finalize(() => {
            this.queries--;
            if (this.queries === 0) {
              this.loadingService.hide();
            }
          }
        )
      );
  }
}

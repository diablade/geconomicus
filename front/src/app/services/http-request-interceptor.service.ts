import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor, HttpResponse
} from '@angular/common/http';
import {Observable} from 'rxjs';
import {catchError, finalize} from 'rxjs/operators'
import {Injectable} from '@angular/core';
import {LoadingService} from '../services/loading.service';
import {SnackbarService} from "../services/snackbar.service";

@Injectable({
  providedIn: 'root'
})
export class HttpRequestInterceptor implements HttpInterceptor {

  private queries: number = 0;

  constructor(private loadingService: LoadingService) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.queries++;

    this.loadingService.show();

    return next.handle(req)
      .pipe(
        // catchError(err => {
        //   this.loadingService.hide();
        //   return err;
        // }),
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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';

@Component({
  selector: 'app-btn-timer-auto-click',
  templateUrl: './btn-timer-auto-click.component.html',
  styleUrls: ['./btn-timer-auto-click.component.scss']
})
export class BtnTimerAutoClickComponent implements OnInit, OnDestroy {
  @Input() label: string = "label";
  @Input() secondsTimer: number = 5;
  // timeLeft: number = 5;
  progress: number = 0;
  timer: any;
  @Output() timerEnd = new EventEmitter<any>();


  constructor() {
  }

  ngOnInit(){
      this.startTimer();
  }


  startTimer() {
    this.progress = 0;
    // this.timeLeft = this.secondsTimer; // Reset time
    const interval = 100; // adjust the interval for smoother progress
    const totalSeconds = this.secondsTimer;
    const totalIterations = totalSeconds * 1000 / interval;
    let iteration = 0;
    this.timer = setInterval(() => {
      iteration++;
      this.progress = (iteration / totalIterations) * 100;
      // this.timeLeft = totalSeconds - Math.floor(iteration / (1000 / interval));
      if (iteration >= totalIterations) {
        clearInterval(this.timer);
        this.timerEnd.emit(this.label);
      }
    }, interval);
  }
  ngOnDestroy(){
        this.timer=null;
  }
}

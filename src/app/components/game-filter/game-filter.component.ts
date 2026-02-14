import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
    selector: 'app-game-filter',
    imports: [FormsModule],
    templateUrl: './game-filter.component.html',
    styleUrls: ['./game-filter.component.scss']
})
export class GameFilterComponent implements OnDestroy {
  @Output() filterChange = new EventEmitter<string>();
  
  filterValue = '';
  private destroy$ = new Subject<void>();
  private filterSubject = new Subject<string>();

  constructor() {
    this.filterSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.filterChange.emit(value);
      });
  }

  onFilterInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filterValue = target.value;
    this.filterSubject.next(this.filterValue);
  }

  clearFilter(): void {
    this.filterValue = '';
    this.filterSubject.next('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
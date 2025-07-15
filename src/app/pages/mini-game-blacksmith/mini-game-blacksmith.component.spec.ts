import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MiniGameBlacksmithComponent } from './mini-game-blacksmith.component';

describe('MiniGameBlacksmithComponent', () => {
  let component: MiniGameBlacksmithComponent;
  let fixture: ComponentFixture<MiniGameBlacksmithComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiniGameBlacksmithComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MiniGameBlacksmithComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

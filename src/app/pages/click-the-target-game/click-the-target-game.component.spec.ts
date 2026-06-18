import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SupabaseService } from '../../services/supabase.service';
import { ClickTheTargetGameComponent } from './click-the-target-game.component';

describe('ClickTheTargetGameComponent', () => {
  let component: ClickTheTargetGameComponent;
  let fixture: ComponentFixture<ClickTheTargetGameComponent>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('SupabaseService', [
      'getClickTargetHighScores',
      'insertClickTargetScore',
    ]);
    spy.getClickTargetHighScores.and.returnValue(Promise.resolve([]));
    spy.insertClickTargetScore.and.returnValue(Promise.resolve(null));

    await TestBed.configureTestingModule({
      imports: [ClickTheTargetGameComponent],
      providers: [{ provide: SupabaseService, useValue: spy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ClickTheTargetGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with sensible defaults', () => {
    expect(component.gameActive).toBeFalse();
    expect(component.gameOver).toBeFalse();
    expect(component.score).toBe(0);
    expect(component.combo).toBe(0);
  });

  it('refuses to start without a name', () => {
    component.playerName = '';
    component.startGame();
    expect(component.gameActive).toBeFalse();
  });

  it('starts with a valid name', () => {
    component.playerName = 'Tester';
    component.startGame();
    expect(component.gameActive).toBeTrue();
    expect(component.timeRemaining).toBe(component.GAME_TIME);
    component.ngOnDestroy();
  });

  it('computes accuracy', () => {
    component.hits = 7;
    component.misses = 3;
    expect(component.getAccuracy()).toBe(70);
  });

  it('escalates the combo multiplier', () => {
    component.combo = 0;
    expect(component.comboMult()).toBe(1);
    component.combo = 5;
    expect(component.comboMult()).toBe(1.5);
    component.combo = 20;
    expect(component.comboMult()).toBe(3);
    component.combo = 30;
    expect(component.comboMult()).toBe(4);
  });

  it('maps target icons', () => {
    expect(component.targetIcon('bomb')).toBe('💣');
    expect(component.targetIcon('bonus')).toBe('⭐');
  });
});

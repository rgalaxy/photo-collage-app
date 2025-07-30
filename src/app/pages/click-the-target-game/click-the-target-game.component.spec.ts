import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SupabaseService } from '../../services/supabase.service';
import { ClickTheTargetGameComponent } from './click-the-target-game.component';

describe('ClickTheTargetGameComponent', () => {
  let component: ClickTheTargetGameComponent;
  let fixture: ComponentFixture<ClickTheTargetGameComponent>;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('SupabaseService', ['getHighScores', 'insertHighScore']);

    await TestBed.configureTestingModule({
      imports: [ClickTheTargetGameComponent, NoopAnimationsModule],
      providers: [
        { provide: SupabaseService, useValue: spy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClickTheTargetGameComponent);
    component = fixture.componentInstance;
    mockSupabaseService = TestBed.inject(SupabaseService) as jasmine.SpyObj<SupabaseService>;
    
    // Setup default mock returns
    mockSupabaseService.getHighScores.and.returnValue(Promise.resolve([]));
    mockSupabaseService.insertHighScore.and.returnValue(Promise.resolve(null));
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.gameActive).toBeFalsy();
    expect(component.gameOver).toBeFalsy();
    expect(component.score).toBe(0);
    expect(component.hits).toBe(0);
    expect(component.misses).toBe(0);
    expect(component.difficulty).toBe('medium');
    expect(component.combo).toBe(0);
  });

  it('should not start game without player name', () => {
    component.playerName = '';
    spyOn(component, 'showToast');
    
    component.startGame();
    
    expect(component.gameActive).toBeFalsy();
    expect(component.showToast).toHaveBeenCalledWith('Please enter your name first!', 'error');
  });

  it('should start game with valid player name', () => {
    component.playerName = 'Test Player';
    
    component.startGame();
    
    expect(component.gameActive).toBeTruthy();
    expect(component.score).toBe(0);
    expect(component.hits).toBe(0);
    expect(component.misses).toBe(0);
    expect(component.combo).toBe(0);
  });

  it('should select difficulty correctly', () => {
    component.selectDifficulty('hard');
    
    expect(component.difficulty).toBe('hard');
    expect(component.showDifficultySelector).toBeFalsy();
  });

  it('should calculate accuracy correctly', () => {
    component.hits = 7;
    component.misses = 3;
    
    expect(component.getAccuracy()).toBe(70);
  });

  it('should format time correctly', () => {
    expect(component.formatTime(65)).toBe('1:05');
    expect(component.formatTime(30)).toBe('0:30');
    expect(component.formatTime(5)).toBe('0:05');
  });

  it('should get correct difficulty colors', () => {
    expect(component.getDifficultyColor('easy')).toBe('text-green-600');
    expect(component.getDifficultyColor('medium')).toBe('text-yellow-600');
    expect(component.getDifficultyColor('hard')).toBe('text-red-600');
  });

  it('should handle target click correctly', () => {
    const target = {
      id: 1,
      x: 50,
      y: 50,
      size: 50,
      timeLeft: 1000,
      isClicked: false
    };
    
    const mockEvent = new MouseEvent('click');
    spyOn(mockEvent, 'preventDefault');
    spyOn(mockEvent, 'stopPropagation');
    
    component.gameActive = true;
    const initialScore = component.score;
    
    component.clickTarget(target, mockEvent);
    
    expect(target.isClicked).toBeTruthy();
    expect(component.hits).toBe(1);
    expect(component.combo).toBe(1);
    expect(component.score).toBeGreaterThan(initialScore);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should reset combo correctly', () => {
    component.combo = 5;
    component.comboMultiplier = 2;
    
    component.resetCombo();
    
    expect(component.combo).toBe(0);
    expect(component.comboMultiplier).toBe(1);
  });

  it('should toggle modals correctly', () => {
    component.toggleHowToPlay();
    expect(component.showHowToPlay).toBeTruthy();
    
    component.toggleHowToPlay();
    expect(component.showHowToPlay).toBeFalsy();
    
    component.toggleHighScores();
    expect(component.showHighScores).toBeTruthy();
    
    component.toggleHighScores();
    expect(component.showHighScores).toBeFalsy();
  });

  it('should call loadHighScores on init', () => {
    spyOn(component, 'loadHighScores');
    
    component.ngOnInit();
    
    expect(component.loadHighScores).toHaveBeenCalled();
  });

  it('should end game and submit score', async () => {
    component.playerName = 'Test Player';
    component.score = 100;
    component.difficulty = 'medium';
    
    await component.endGame();
    
    expect(component.gameActive).toBeFalsy();
    expect(component.gameOver).toBeTruthy();
    expect(component.showGameOverModal).toBeTruthy();
    expect(mockSupabaseService.insertHighScore).toHaveBeenCalledWith(
      'Test Player',
      100,
      'Click Target (medium)'
    );
  });

  it('should track targets by id', () => {
    const target = { id: 123, x: 0, y: 0, size: 50, timeLeft: 1000, isClicked: false };
    
    expect(component.trackByTargetId(0, target)).toBe(123);
  });
});

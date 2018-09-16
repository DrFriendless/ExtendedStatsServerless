import { TestBed, async } from '@angular/core/testing';
import { MonthlyWidget } from './app.component';
describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        MonthlyWidget
      ],
    }).compileComponents();
  }));
  it('should create the app', async(() => {
    const fixture = TestBed.createComponent(MonthlyWidget);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));
});

import { TestBed } from '@angular/core/testing';
import { BRAND_NAME } from './brand';

describe('BRAND_NAME', () => {
  it('provides default value "Lilcare"', () => {
    const brand = TestBed.inject(BRAND_NAME);
    expect(brand).toBe('Lilcare');
  });
});

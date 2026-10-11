import { FormControl, FormGroup } from '@angular/forms';
import { atLeastOneParent, greaterThanZero } from './validators';

describe('greaterThanZero (P31)', () => {
  it.each([
    [0, { greaterThanZero: true }],
    ['0', { greaterThanZero: true }],
    ['0.0', { greaterThanZero: true }],
    [-1, { greaterThanZero: true }],
    [1, null],
    ['0.5', null],
    ['12.3', null],
    ['', null],
    [null, null],
    ['abc', null],
  ])('validates %j', (value, expected) => {
    expect(greaterThanZero(new FormControl(value))).toEqual(expected);
  });
});

describe('atLeastOneParent (P32)', () => {
  it.each([
    ['Padre', '', null],
    ['', 'Madre', null],
    ['Padre', 'Madre', null],
    ['', '', { atLeastOneParent: true }],
    ['   ', '  ', { atLeastOneParent: true }],
  ])('father=%j mother=%j', (father, mother, expected) => {
    const group = new FormGroup({ fatherName: new FormControl(father), motherName: new FormControl(mother) });
    expect(atLeastOneParent(group)).toEqual(expected);
  });
});

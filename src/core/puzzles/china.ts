import { mulberry32, pickFrom } from '../rng';

/** Real goods that moved west along the Silk Road out of Han-dynasty China. */
export type Good = 'silk' | 'paper' | 'tea' | 'porcelain';

export const GOODS: Good[] = ['silk', 'paper', 'tea', 'porcelain'];

export const GOOD_INFO: Record<Good, { label: string; fact: string }> = {
  silk: { label: 'Silk', fact: 'Shimmering silk cloth was so prized in Rome that some senators tried to ban it as a wasteful luxury.' },
  paper: { label: 'Paper', fact: 'Papermaking spread west after the Battle of Talas in 751 CE, when Chinese papermakers were captured and shared the technique.' },
  tea: { label: 'Tea', fact: 'Dried tea leaves kept for months on the road and became a staple trade good across Central Asia.' },
  porcelain: { label: 'Porcelain', fact: "Chinese porcelain was so fine that Europeans called all fine ceramics 'china' after its source." },
};

export interface CaravanStop {
  id: number;
  /** The merchant's request at this stop. */
  request: CaravanRequest;
  correctGood: Good;
}

export type CaravanRequest = 'scholar-baghdad' | 'noble-rome' | 'trader-persia' | 'merchant-venice';

const REQUEST_GOOD: Record<CaravanRequest, Good> = {
  'scholar-baghdad': 'paper',
  'noble-rome': 'silk',
  'trader-persia': 'tea',
  'merchant-venice': 'porcelain',
};

const REQUESTS: CaravanRequest[] = ['scholar-baghdad', 'noble-rome', 'trader-persia', 'merchant-venice'];

export function generateStops(count: number, seed: number): CaravanStop[] {
  const rand = mulberry32(seed);
  const stops: CaravanStop[] = [];
  for (let i = 0; i < count; i++) {
    const request = pickFrom(rand, REQUESTS);
    stops.push({ id: i, request, correctGood: REQUEST_GOOD[request] });
  }
  return stops;
}

export function checkGood(stop: CaravanStop, chosenGood: Good): boolean {
  return stop.correctGood === chosenGood;
}

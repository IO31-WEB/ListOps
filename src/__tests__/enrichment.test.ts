import { describe, test, expect } from 'vitest'
import { mapRealieProperty } from '@/lib/enrichment/realie'

// Payloads modeled on the field names in Realie's published v3 + legacy schemas.
const V3 = {
  realieParcelId: '45035-123', address: '905 WOODSIDE CREEK LN', state: 'SC', zipCode: '29485',
  propertyLocation: { city: 'SUMMERVILLE', address: '905 WOODSIDE CREEK LN' },
  propertyClassification: { condo: false, residential: true },
  generalInformation: { numberOfUnits: 1 },
  roomInformation: { bedCount: 4, bathCount: 2.5 },
  buildingInformation: { buildings: [{
    buildingNumber: 1, stories: 2, livingArea: 2410, buildingArea: 3050, actualYearBuilt: 2004,
    totalBedrooms: 4, totalBathrooms: 2.5, garage: true, garageCount: 2, pool: true, fireplace: true, fireplaceCount: 1,
  }] },
}
const V2_FLAT = { address: '1 Main St', city: 'Charleston', state: 'SC', zipCode: '29401', totalBedrooms: 3, totalBathrooms: 2, buildingArea: 1800, yearBuilt: 1998 }

describe('Realie mapping', () => {
  test('v3 nested shape: facts + features come through', () => {
    const r = mapRealieProperty(V3)
    expect(r).toMatchObject({ bedrooms: 4, bathrooms: 2.5, sqft: 2410, yearBuilt: 2004, city: 'SUMMERVILLE', zip: '29485' })
    expect(r.features).toEqual(expect.arrayContaining(['2-Car Garage', 'Pool', 'Fireplace', '2-Story']))
  })
  test('prefers heated living area over gross building area', () => {
    expect(mapRealieProperty(V3).sqft).toBe(2410)
  })
  test('legacy flat shape still works', () => {
    expect(mapRealieProperty(V2_FLAT)).toMatchObject({ bedrooms: 3, bathrooms: 2, sqft: 1800, yearBuilt: 1998 })
  })
  test('condo and multi-family are detected; ambiguous types are left blank', () => {
    expect(mapRealieProperty({ ...V3, propertyClassification: { condo: true } }).propertyType).toBe('Condo')
    expect(mapRealieProperty({ ...V3, generalInformation: { numberOfUnits: 4 } }).propertyType).toBe('Multi-Family')
    expect(mapRealieProperty(V3).propertyType).toBeUndefined()
  })
  test('missing/odd fields never throw and never produce zeros or NaN', () => {
    const r = mapRealieProperty({ buildingInformation: { buildings: [null, 'x', {}] }, roomInformation: 'bad', totalBedrooms: 0, buildingArea: -5 })
    expect(r.bedrooms).toBeUndefined()
    expect(r.sqft).toBeUndefined()
    expect(r.features).toEqual([])
  })
})

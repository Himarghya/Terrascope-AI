/**
 * Building Narration Service
 * Generates natural, authoritative spoken descriptions of building heights,
 * footprint dimensions, and architectural features for ElevenLabs Voice synthesis.
 */

export function formatBuildingNarration(b: any): string {
  if (!b) return 'Building details not available.'

  // Extract ID
  const rawId = b.id || b.building_id || 'Selected'
  const idDisplay =
    typeof rawId === 'string' && rawId.startsWith('bld_')
      ? `Building ${rawId.replace('bld_', '')}`
      : `Building ${rawId}`

  // Height & floors
  const heightVal = b.estimated_height_m ?? b.height_m ?? b.total_height ?? b.total_height_m
  const floorsVal =
    b.estimated_floors ??
    b.classification?.floors ??
    b.floors ??
    (heightVal ? Math.max(1, Math.round(Number(heightVal) / 3.2)) : null)

  // Dimensions & footprint
  const widthVal = b.width_m ? Math.round(Number(b.width_m) * 10) / 10 : null
  const lengthVal = b.length_m ? Math.round(Number(b.length_m) * 10) / 10 : null
  const areaVal =
    b.footprint_area_m2 ?? b.area_m2
      ? Math.round(Number(b.footprint_area_m2 ?? b.area_m2))
      : null

  // Morphology & Style
  const roof = b.roof_shape ?? b.classification?.roof_style ?? b.roof_style
  const material = b.roof_material ?? b.classification?.roof_material
  const typology = b.building_type ?? b.classification?.category ?? b.category_name ?? b.category
  const archStyle = b.classification?.architectural_style

  const sentences: string[] = []

  // 1. Identification & Height
  if (heightVal !== undefined && heightVal !== null && !isNaN(Number(heightVal))) {
    const roundedH = Math.round(Number(heightVal) * 10) / 10
    const floorPhrase = floorsVal
      ? ` across ${floorsVal} ${floorsVal === 1 ? 'floor' : 'floors'}`
      : ''
    sentences.push(`${idDisplay} has an estimated height of ${roundedH} meters${floorPhrase}.`)
  } else {
    sentences.push(`${idDisplay} selected.`)
  }

  // 2. Footprint Dimensions
  if (widthVal && lengthVal) {
    if (areaVal) {
      sentences.push(
        `Footprint dimensions are ${widthVal} by ${lengthVal} meters, covering ${areaVal} square meters.`
      )
    } else {
      sentences.push(`Footprint dimensions are ${widthVal} by ${lengthVal} meters.`)
    }
  } else if (areaVal) {
    sentences.push(`Footprint covers ${areaVal} square meters.`)
  }

  // 3. Features & Architectural Morphology
  const featureList: string[] = []
  if (typology && typology !== 'unknown' && typology !== 'Unclassified') {
    featureList.push(`${typology.toString().replace(/_/g, ' ')} classification`)
  }
  if (archStyle && archStyle !== 'generic') {
    featureList.push(`${archStyle.toString().replace(/_/g, ' ')} style`)
  }
  if (roof && roof !== 'unknown') {
    const cleanRoof = roof.toString().toLowerCase().replace('roof', '').trim()
    featureList.push(`${cleanRoof || roof} roof`)
  }
  if (material && material !== 'unknown') {
    featureList.push(`${material.toString().toLowerCase()} materials`)
  }
  if (b.has_solar_panels) {
    featureList.push('rooftop solar panels')
  }
  if (b.has_hvac_units) {
    featureList.push('HVAC ventilation units')
  }
  if (b.components && typeof b.components === 'object') {
    const compKeys = Object.keys(b.components).filter((k) => !['walls', 'roof'].includes(k))
    if (compKeys.includes('windows')) featureList.push('detailed window framing')
    if (compKeys.includes('doors')) featureList.push('entry portals')
    if (compKeys.includes('fire_escapes')) featureList.push('exterior fire escapes')
  }

  if (featureList.length > 0) {
    sentences.push(`Architectural features include ${featureList.join(', ')}.`)
  }

  return sentences.join(' ')
}

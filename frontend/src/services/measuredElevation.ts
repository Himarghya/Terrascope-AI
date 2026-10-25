/**
 * Terra3D Measured Elevation & Photogrammetry Engine.
 *
 * Implements:
 * 1. GeoTIFF DTM (bare-earth) and DSM (surface) metadata parsing & windowed raster ingestion (geotiff.js + proj4).
 * 2. WGS84 Georeferencing bounds validation, aspect ratio checking, and regional LiDAR dataset advisory.
 * 3. Bilinear elevation interpolation & spatial diffusion hole-filling (fillNaN).
 * 4. DSM - DTM separation, ground offset leveling, and object height extraction (p90).
 * 5. Analytical hillshading, hypsometric elevation tinting, and dynamic contour line baking.
 * 6. Independent validation check-point statistical evaluation (Bias, RMSE).
 * 7. Procedural satellite imagery and urban canvas generator.
 */

import * as GeoTIFF from 'geotiff'
import proj4 from 'proj4'

export interface GeoreferenceBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface GeoTiffRasterMetadata {
  filename: string
  type: 'DTM' | 'DSM'
  epsg: number
  crsDefinition: string
  width: number
  height: number
  resolutionMetersPerPx: number
  boundingBox: [number, number, number, number]
  verticalUnitsScale: number
  verticalDatum: string
  acquisitionDate: string
  verticalAccuracyRmseM?: number
  noDataValue: number | null
  datasetName?: string
}

export interface GeoTiffRasterData extends GeoTiffRasterMetadata {
  rasterWindow: Float32Array
  windowX0: number
  windowY0: number
  windowWidth: number
  windowHeight: number
  rx: number
  ry: number
  projForward: (coords: [number, number]) => [number, number]
}

export interface ValidationPoint {
  lat: number
  lon: number
  expectedValueM: number
  isObjectHeight: boolean
}

export interface ValidationStatistics {
  count: number
  biasM: number
  rmseM: number
}

export interface ValidationReport {
  groundElevation?: ValidationStatistics
  objectHeight?: ValidationStatistics
  summaryText: string
  isValidated: boolean
}

export interface MeasuredElevationResult {
  isMeasured: boolean
  dataSource: string
  confidenceRating: 'High' | 'Medium' | 'Low (coarse)' | 'Low (gaps over 20%)' | 'Image-derived'
  elevationMinM: number
  elevationMaxM: number
  elevationRangeM: string
  meanSlopeDeg: number
  dtmElevations: Float32Array
  dsmElevations?: Float32Array
  objectHeightsNdsm?: Float32Array
  dtmCoveragePct: number
  dsmCoveragePct?: number
  offsetRemovedM?: number
  warnings: string[]
  regionalAdvisor: string
  validationReport: ValidationReport
}

/**
 * Returns Proj4 CRS definition for standard geographic & projected coordinate systems.
 */
export function getCrsDefinition(code: number): string | null {
  if (code === 4326 || code === 4269 || code === 4258) return 'EPSG:4326'
  if (code === 3857 || code === 900913) return 'EPSG:3857'
  // WGS84 UTM Northern Hemisphere: EPSG:32601 to 32660
  if (code >= 32601 && code <= 32660) {
    return `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs`
  }
  // WGS84 UTM Southern Hemisphere: EPSG:32701 to 32760
  if (code >= 32701 && code <= 32760) {
    return `+proj=utm +zone=${code - 32700} +south +datum=WGS84 +units=m +no_defs`
  }
  // NAD83 UTM zones: EPSG:26901 to 26923
  if (code >= 26901 && code <= 26923) {
    return `+proj=utm +zone=${code - 26900} +datum=NAD83 +units=m +no_defs`
  }
  // ETRS89 UTM zones: EPSG:25828 to 25838
  if (code >= 25828 && code <= 25838) {
    return `+proj=utm +zone=${code - 25800} +ellps=GRS80 +units=m +no_defs`
  }
  return null
}

/**
 * Provides authoritative regional LiDAR and elevation source recommendations based on bounding box.
 */
export function suggestRegionalDatasets(bounds: GeoreferenceBounds): string {
  const midLat = (bounds.south + bounds.north) / 2
  const midLon = (bounds.west + bounds.east) / 2
  const globalFallback =
    'Global open DEM options: Copernicus GLO-30 (~30m DSM), NASADEM (~30m), FABDEM (~30m bare-earth terrain).'

  // Contiguous United States (CONUS)
  if (midLat > 24 && midLat < 50 && midLon > -125 && midLon < -66) {
    return (
      'Authoritative source: USGS 3D Elevation Program (3DEP) LiDAR (up to 1m/px resolution) via The National Map (TNM) Downloader or OpenTopography. ' +
      globalFallback
    )
  }
  // United Kingdom / England
  if (midLat > 49.8 && midLat < 60.9 && midLon > -8.7 && midLon < 1.8) {
    return (
      'Authoritative source (England & Wales): DEFRA / Environment Agency LiDAR Composite DTM/DSM (1m and 2m resolution). ' +
      globalFallback
    )
  }
  // Netherlands
  if (midLat > 50.7 && midLat < 53.6 && midLon > 3.3 && midLon < 7.3) {
    return (
      'Authoritative source: Actueel Hoogtebestand Nederland (AHN4 / AHN5) LiDAR DSM/DTM (~0.5m resolution via PDOK). ' +
      globalFallback
    )
  }
  // Japan (e.g. Sapporo / Tokyo)
  if (midLat > 30.0 && midLat < 46.0 && midLon > 128.0 && midLon < 146.0) {
    return (
      'Authoritative source (Japan): Geospatial Information Authority of Japan (GSI) 5m/10m DEM & Project PLATEAU 3D city models. ' +
      globalFallback
    )
  }

  return (
    'No local 1m LiDAR repository pre-configured for this region; consult your national mapping agency for aerial LiDAR. ' +
    globalFallback
  )
}

/**
 * Parses and validates WGS84 bounding box coordinates.
 */
export function validateGeoreferenceBounds(
  westStr: string,
  southStr: string,
  eastStr: string,
  northStr: string
): GeoreferenceBounds | null {
  const w = parseFloat(westStr)
  const s = parseFloat(southStr)
  const e = parseFloat(eastStr)
  const n = parseFloat(northStr)

  if (isNaN(w) || isNaN(s) || isNaN(e) || isNaN(n)) {
    return null
  }
  if (w >= e || s >= n) {
    throw new Error('Invalid bounds: West must be < East and South must be < North.')
  }
  if (Math.abs(s) > 90 || Math.abs(n) > 90 || Math.abs(w) > 180 || Math.abs(e) > 180) {
    throw new Error('Coordinates out of range: Latitude [-90, 90], Longitude [-180, 180].')
  }
  if (e - w > 2.0 || n - s > 2.0) {
    throw new Error('Image footprint exceeds 2 degrees. Please crop to localized target extent.')
  }

  return { west: w, south: s, east: e, north: n }
}

/**
 * Loads and inspects GeoTIFF file metadata (header, CRS, resolution, datum).
 */
export async function loadGeoTiffMetadata(
  file: File,
  type: 'DTM' | 'DSM'
): Promise<GeoTiffRasterData> {
  const tiff = await GeoTIFF.fromBlob(file)
  const image = await tiff.getImage()
  const geoKeys = image.getGeoKeys() || {}
  const bbox = image.getBoundingBox() as [number, number, number, number]
  const [resX, resY] = image.getResolution()

  const epsgCode =
    geoKeys.ProjectedCSTypeGeoKey && geoKeys.ProjectedCSTypeGeoKey !== 32767
      ? geoKeys.ProjectedCSTypeGeoKey
      : geoKeys.GeographicTypeGeoKey || 4326

  const crsDef = getCrsDefinition(epsgCode)
  if (!crsDef) {
    throw new Error(
      `CRS EPSG:${epsgCode || 'Unknown'} is not currently supported. Please reproject to EPSG:4326 or standard UTM.`
    )
  }

  const isGeographic = crsDef === 'EPSG:4326'
  const midLat = (bbox[1] + bbox[3]) / 2
  const resolutionMetersPerPx = Math.max(
    Math.abs(resX) * (isGeographic ? 111320 * Math.cos((midLat * Math.PI) / 180) : 1),
    Math.abs(resY) * (isGeographic ? 110574 : 1)
  )

  const verticalUnitsKey = geoKeys.VerticalUnitsGeoKey
  const verticalUnitsScale =
    verticalUnitsKey === 9002 ? 0.3048 : verticalUnitsKey === 9003 ? 0.3048006 : 1.0

  const fileDir = image.fileDirectory as any
  const dateTime = String(fileDir?.DateTime || '')
    .slice(0, 10)
    .replace(/:/g, '-')

  const verticalDatum = geoKeys.VerticalCSTypeGeoKey
    ? `EPSG:${geoKeys.VerticalCSTypeGeoKey}`
    : 'Not Specified (Local Datum)'

  const projForward = (coords: [number, number]): [number, number] => {
    return proj4('EPSG:4326', crsDef, coords) as [number, number]
  }

  return {
    filename: file.name,
    type,
    epsg: epsgCode,
    crsDefinition: crsDef,
    width: image.getWidth(),
    height: image.getHeight(),
    resolutionMetersPerPx,
    boundingBox: bbox,
    verticalUnitsScale,
    verticalDatum,
    acquisitionDate: dateTime,
    noDataValue: image.getGDALNoData(),
    rasterWindow: new Float32Array(0),
    windowX0: 0,
    windowY0: 0,
    windowWidth: 0,
    windowHeight: 0,
    rx: Math.abs(resX),
    ry: Math.abs(resY),
    projForward,
  }
}

/**
 * Loads the intersecting window of the GeoTIFF raster matching the scene bounding box.
 */
export async function loadIntersectingGeoTiffWindow(
  file: File,
  meta: GeoTiffRasterData,
  bounds: GeoreferenceBounds
): Promise<GeoTiffRasterData> {
  const tiff = await GeoTIFF.fromBlob(file)
  const image = await tiff.getImage()

  // Project bounding box corners to raster projected CRS
  const perimeterPoints: [number, number][] = []
  for (let i = 0; i <= 8; i++) {
    const fx = i / 8
    perimeterPoints.push(
      meta.projForward([bounds.west + fx * (bounds.east - bounds.west), bounds.north]),
      meta.projForward([bounds.west + fx * (bounds.east - bounds.west), bounds.south]),
      meta.projForward([bounds.west, bounds.south + fx * (bounds.north - bounds.south)]),
      meta.projForward([bounds.east, bounds.south + fx * (bounds.north - bounds.south)])
    )
  }

  const xs = perimeterPoints.map((p) => p[0])
  const ys = perimeterPoints.map((p) => p[1])

  const x0 = Math.max(0, Math.floor((Math.min(...xs) - meta.boundingBox[0]) / meta.rx) - 1)
  const x1 = Math.min(image.getWidth(), Math.ceil((Math.max(...xs) - meta.boundingBox[0]) / meta.rx) + 1)
  const y0 = Math.max(0, Math.floor((meta.boundingBox[3] - Math.max(...ys)) / meta.ry) - 1)
  const y1 = Math.min(image.getHeight(), Math.ceil((meta.boundingBox[3] - Math.min(...ys)) / meta.ry) + 1)

  if (x1 - x0 < 2 || y1 - y0 < 2) {
    throw new Error(`${meta.type} raster does not spatially intersect the specified image bounds.`)
  }

  const windowSize = (x1 - x0) * (y1 - y0)
  if (windowSize > 1e8) {
    throw new Error(`${meta.type} window is too large for client memory. Please crop the raster.`)
  }

  const rasters = await image.readRasters({
    window: [x0, y0, x1, y1],
    samples: [0],
  })

  const rawData = rasters[0] as Float32Array | Int16Array | Float64Array
  const floatData = new Float32Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    floatData[i] = rawData[i]
  }

  return {
    ...meta,
    rasterWindow: floatData,
    windowX0: x0,
    windowY0: y0,
    windowWidth: x1 - x0,
    windowHeight: y1 - y0,
  }
}

/**
 * Bilinear sampling of elevation raster at a WGS84 (lon, lat) coordinate.
 */
export function sampleElevationAtWgs84(
  raster: GeoTiffRasterData,
  lon: number,
  lat: number
): number {
  if (!raster.rasterWindow || raster.rasterWindow.length === 0) return NaN

  const [projX, projY] = raster.projForward([lon, lat])
  const fx = (projX - raster.boundingBox[0]) / raster.rx - 0.5 - raster.windowX0
  const fy = (raster.boundingBox[3] - projY) / raster.ry - 0.5 - raster.windowY0
  const i = Math.floor(fx)
  const j = Math.floor(fy)

  let sum = 0
  let totalWeight = 0

  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      const px = i + a
      const py = j + b
      if (px < 0 || py < 0 || px >= raster.windowWidth || py >= raster.windowHeight) continue

      const val = raster.rasterWindow[py * raster.windowWidth + px]
      if (isNaN(val) || val === raster.noDataValue || val < -10000 || val > 90000) continue

      const weight = (a ? fx - i : 1 - (fx - i)) * (b ? fy - j : 1 - (fy - j))
      sum += val * raster.verticalUnitsScale * weight
      totalWeight += weight
    }
  }

  return totalWeight > 0.5 ? sum / totalWeight : NaN
}

/**
 * Iterative Gaussian blur hole-filling for missing nodata pixels.
 */
export function fillElevationGaps(
  data: Float32Array,
  gridWidth: number,
  gridHeight: number
): { elevations: Float32Array; missingMask: Uint8Array; coverageRatio: number } {
  const total = data.length
  const missingMask = new Uint8Array(total)
  const filled = new Float32Array(total)
  const weight = new Float32Array(total)

  let missingCount = 0
  let validSum = 0
  let validCount = 0

  for (let i = 0; i < total; i++) {
    const v = data[i]
    if (isNaN(v)) {
      missingMask[i] = 1
      missingCount++
    } else {
      filled[i] = v
      weight[i] = 1
      validSum += v
      validCount++
    }
  }

  const coverageRatio = 1.0 - missingCount / total

  // Diffusion passes
  const blurPass = (input: Float32Array, w: number, h: number, r: number): Float32Array => {
    const temp = new Float32Array(total)
    const out = new Float32Array(total)
    const n = 2 * r + 1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0
        for (let k = -r; k <= r; k++) {
          s += input[y * w + Math.min(w - 1, Math.max(0, x + k))]
        }
        temp[y * w + x] = s / n
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0
        for (let k = -r; k <= r; k++) {
          s += temp[Math.min(h - 1, Math.max(0, y + k)) * w + x]
        }
        out[y * w + x] = s / n
      }
    }
    return out
  }

  for (let iter = 0; iter < 8 && missingCount > 0; iter++) {
    const bZ = blurPass(filled, gridWidth, gridHeight, 8)
    const bW = blurPass(weight, gridWidth, gridHeight, 8)
    const newlyFilled: number[] = []
    missingCount = 0

    for (let i = 0; i < total; i++) {
      if (weight[i] === 0) {
        if (bW[i] > 0.02) {
          filled[i] = bZ[i] / bW[i]
          newlyFilled.push(i)
        } else {
          missingCount++
        }
      }
    }
    newlyFilled.forEach((idx) => {
      weight[idx] = 1.0
    })
  }

  // Fallback constant fill if isolated edge pixels remained
  const meanVal = validCount > 0 ? validSum / validCount : 0.0
  for (let i = 0; i < total; i++) {
    if (weight[i] === 0) filled[i] = meanVal
  }

  return { elevations: filled, missingMask, coverageRatio }
}

/**
 * Hypsometric color ramp function: maps normalized [0..1] elevation to RGB.
 */
export function getHypsometricColor(t: number): [number, number, number] {
  const steps: [number, [number, number, number]][] = [
    [0.0, [0.1, 0.25, 0.3]],
    [0.3, [0.25, 0.5, 0.25]],
    [0.65, [0.65, 0.58, 0.4]],
    [1.0, [0.95, 0.95, 0.95]],
  ]
  const clampedT = Math.max(0, Math.min(1, t))
  for (let i = 1; i < steps.length; i++) {
    if (clampedT <= steps[i][0]) {
      const a = steps[i - 1]
      const b = steps[i]
      const f = (clampedT - a[0]) / (b[0] - a[0])
      return [
        a[1][0] + (b[1][0] - a[1][0]) * f,
        a[1][1] + (b[1][1] - a[1][1]) * f,
        a[1][2] + (b[1][2] - a[1][2]) * f,
      ]
    }
  }
  return steps[steps.length - 1][1]
}

/**
 * Bakes high-resolution hypsometric hillshaded texture with dynamic contour lines.
 */
export function bakeHypsometricAndContours(
  elevations: Float32Array,
  landcover: Uint8Array,
  gw: number,
  gh: number,
  worldWidthM: number,
  elevRangeM: number
): { hypsometricTextureCanvas: HTMLCanvasElement; landcoverTextureCanvas: HTMLCanvasElement } {
  const scale = 3
  const w = gw * scale
  const h = gh * scale
  const k = Math.max(0.5, elevRangeM) / (worldWidthM / gw)

  const hypCanvas = document.createElement('canvas')
  hypCanvas.width = w
  hypCanvas.height = h
  const hypCtx = hypCanvas.getContext('2d')!

  const lcCanvas = document.createElement('canvas')
  lcCanvas.width = w
  lcCanvas.height = h
  const lcCtx = lcCanvas.getContext('2d')!

  const hypImgData = hypCtx.createImageData(w, h)
  const lcImgData = lcCtx.createImageData(w, h)

  // Color lookup for land cover classes
  const lcColors: [number, number, number][] = [
    [194, 168, 120], // Bare land
    [76, 195, 138],  // Vegetation
    [59, 167, 255],  // Water
    [176, 183, 195], // Built-up
    [80, 85, 95],    // Roads
    [45, 120, 200],  // Deep water
    [15, 18, 25],    // Shadow
  ]

  // Min and max for normalization
  let minElev = Infinity
  let maxElev = -Infinity
  for (let i = 0; i < elevations.length; i++) {
    if (elevations[i] < minElev) minElev = elevations[i]
    if (elevations[i] > maxElev) maxElev = elevations[i]
  }
  const elevSpan = maxElev - minElev || 1.0

  const sampleH = (x: number, y: number): number => {
    const cx = Math.min(gw - 1.001, Math.max(0, x))
    const cy = Math.min(gh - 1.001, Math.max(0, y))
    const x0 = Math.floor(cx)
    const y0 = Math.floor(cy)
    const fx = cx - x0
    const fy = cy - y0
    const i = y0 * gw + x0
    const h00 = (elevations[i] - minElev) / elevSpan
    const h10 = (elevations[i + 1] - minElev) / elevSpan
    const h01 = (elevations[i + gw] - minElev) / elevSpan
    const h11 = (elevations[i + gw + 1] - minElev) / elevSpan
    return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy
  }

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const gx = (px + 0.5) / scale - 0.5
      const gy = (py + 0.5) / scale - 0.5

      const hh = sampleH(gx, gy)
      const dx = (sampleH(gx + 1, gy) - sampleH(gx - 1, gy)) / 2
      const dy = (sampleH(gx, gy + 1) - sampleH(gx, gy - 1)) / 2

      // Hillshade normal vector
      const nx = -dx * k
      const nz = -dy * k
      const shade = Math.max(0, (nx * 0.46 + 0.77 + nz * 0.31) / Math.hypot(nx, 1, nz))

      // Contour line check (every 5% elevation interval)
      const contourDist = Math.abs(hh * 20 - Math.round(hh * 20))
      const gradMag = (Math.abs(dx) + Math.abs(dy)) * 20
      const isContour = contourDist < Math.max(gradMag * 0.8, 0.015)
      const lineMultiplier = isContour ? 0.62 : 1.0
      const multiplier = (0.55 + 0.7 * shade) * lineMultiplier

      const baseRgb = getHypsometricColor(hh)
      const idx = (py * w + px) * 4

      // 1. Hypsometric + Hillshade + Contour
      hypImgData.data[idx] = Math.min(255, baseRgb[0] * multiplier * 255)
      hypImgData.data[idx + 1] = Math.min(255, baseRgb[1] * multiplier * 255)
      hypImgData.data[idx + 2] = Math.min(255, baseRgb[2] * multiplier * 255)
      hypImgData.data[idx + 3] = 255

      // 2. Thematic Land Cover with Hillshade
      const nearestClass =
        landcover[Math.min(gh - 1, Math.max(0, Math.round(gy))) * gw + Math.min(gw - 1, Math.max(0, Math.round(gx)))] || 0
      const cRgb = lcColors[nearestClass % lcColors.length]
      const lcMul = 0.6 + 0.6 * shade

      lcImgData.data[idx] = Math.min(255, (cRgb[0] / 255) * lcMul * 255)
      lcImgData.data[idx + 1] = Math.min(255, (cRgb[1] / 255) * lcMul * 255)
      lcImgData.data[idx + 2] = Math.min(255, (cRgb[2] / 255) * lcMul * 255)
      lcImgData.data[idx + 3] = 255
    }
  }

  hypCtx.putImageData(hypImgData, 0, 0)
  lcCtx.putImageData(lcImgData, 0, 0)

  return {
    hypsometricTextureCanvas: hypCanvas,
    landcoverTextureCanvas: lcCanvas,
  }
}

/**
 * Validates measured elevation against independent ground truth survey checkpoints.
 */
export function evaluateValidationCheckpoints(
  dtmRaster: GeoTiffRasterData | null,
  dsmRaster: GeoTiffRasterData | null,
  rawText: string
): ValidationReport {
  if (!rawText.trim() || (!dtmRaster && !dsmRaster)) {
    return {
      isValidated: false,
      summaryText:
        'No independent ground-truth check points provided. Add "lat,lon,elev_m" (ground) or "lat,lon,height_m,h" (object) to validate.',
    }
  }

  const elevErrors: number[] = []
  const heightErrors: number[] = []

  const lines = rawText.split('\n')
  for (const line of lines) {
    const parts = line.split(',').map((s) => s.trim())
    if (parts.length < 3) continue

    const lat = parseFloat(parts[0])
    const lon = parseFloat(parts[1])
    const zExpected = parseFloat(parts[2])
    const isHeight = parts[3]?.toLowerCase() === 'h'

    if (isNaN(lat) || isNaN(lon) || isNaN(zExpected)) continue

    if (isHeight) {
      if (dtmRaster && dsmRaster) {
        const dsmVal = sampleElevationAtWgs84(dsmRaster, lon, lat)
        const dtmVal = sampleElevationAtWgs84(dtmRaster, lon, lat)
        if (!isNaN(dsmVal) && !isNaN(dtmVal)) {
          heightErrors.push(dsmVal - dtmVal - zExpected)
        }
      }
    } else {
      const activeRaster = dtmRaster || dsmRaster
      if (activeRaster) {
        const val = sampleElevationAtWgs84(activeRaster, lon, lat)
        if (!isNaN(val)) {
          elevErrors.push(val - zExpected)
        }
      }
    }
  }

  const calcStats = (errors: number[]): ValidationStatistics | undefined => {
    if (errors.length === 0) return undefined
    const bias = errors.reduce((acc, v) => acc + v, 0) / errors.length
    const rmse = Math.sqrt(errors.reduce((acc, v) => acc + v * v, 0) / errors.length)
    return { count: errors.length, biasM: Number(bias.toFixed(2)), rmseM: Number(rmse.toFixed(2)) }
  }

  const groundStats = calcStats(elevErrors)
  const objectStats = calcStats(heightErrors)
  const isValidated = Boolean(groundStats || objectStats)

  let summary = ''
  if (groundStats) {
    summary += `Ground Elevation: n=${groundStats.count}, Bias ${groundStats.biasM > 0 ? '+' : ''}${groundStats.biasM}m, RMSE ${groundStats.rmseM}m. `
  }
  if (objectStats) {
    summary += `Object Height: n=${objectStats.count}, Bias ${objectStats.biasM > 0 ? '+' : ''}${objectStats.biasM}m, RMSE ${objectStats.rmseM}m.`
  }
  if (!summary) {
    summary = 'No coordinates within raster extents could be matched.'
  }

  return {
    groundElevation: groundStats,
    objectHeight: objectStats,
    summaryText: summary,
    isValidated,
  }
}

/**
 * Generates an instant synthetic procedural satellite image demo canvas.
 */
export function generateProceduralSatelliteSample(): { dataUrl: string; filename: string } {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')!

  // 1. Natural land surface gradient
  const grad = ctx.createLinearGradient(0, 0, 640, 0)
  grad.addColorStop(0, '#6b5d4a')   // Sandy soil
  grad.addColorStop(0.4, '#4f6b3a') // Woodland green
  grad.addColorStop(1, '#5f8a45')   // Meadow
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 640, 480)

  // 2. Random vegetation and surface canopy clusters
  for (let i = 0; i < 320; i++) {
    const px = Math.random() * (i % 2 ? 640 : 230)
    const py = Math.random() * 480
    const r = 14 + Math.random() * 44
    const rg = ctx.createRadialGradient(px, py, 0, px, py, r)
    const isDark = Math.random() < 0.45
    rg.addColorStop(0, isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.28)')
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rg
    ctx.fillRect(px - r, py - r, 2 * r, 2 * r)
  }

  // 3. Meandering river water body
  ctx.strokeStyle = '#1f5f8f'
  ctx.lineWidth = 24
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(330, -10)
  ctx.bezierCurveTo(250, 150, 420, 230, 300, 330)
  ctx.bezierCurveTo(230, 420, 330, 450, 310, 500)
  ctx.stroke()

  // 4. Urban industrial & commercial built-up parcel
  ctx.fillStyle = '#4a4f57'
  ctx.fillRect(400, 250, 190, 160)
  ctx.strokeStyle = '#33363c'
  ctx.lineWidth = 6

  for (let i = 0; i <= 190; i += 48) {
    ctx.beginPath()
    ctx.moveTo(400 + i, 250)
    ctx.lineTo(400 + i, 410)
    ctx.stroke()
  }
  for (let j = 0; j <= 160; j += 40) {
    ctx.beginPath()
    ctx.moveTo(400, 250 + j)
    ctx.lineTo(590, 250 + j)
    ctx.stroke()
  }

  // 5. Individual rooftop variations
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const lum = (170 + Math.random() * 60) | 0
      ctx.fillStyle = `rgb(${lum}, ${lum}, ${lum + 6})`
      ctx.fillRect(408 + i * 48, 258 + j * 40, 34, 28)
    }
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    filename: 'procedural_synthetic_satellite_scene.jpg',
  }
}

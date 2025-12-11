import fs from 'fs'
import path from 'path'

export interface AllureLabel {
  name: string
  value: string
}

export interface AllureStatusDetails {
  trace?: string
}

export interface AllureTestResult {
  uuid: string
  name: string
  status: 'passed' | 'failed' | 'broken' | 'skipped'
  start?: number
  stop?: number
  labels?: AllureLabel[]
  statusDetails?: AllureStatusDetails
}


export interface ParsedTest {
  name: string
  status: string
  duration?: number
  trace?: string
}

export interface ParsedSuite {
  suite: string
  suiteId: string | null
  backlogItemRef: string | null
  productAreaRefId: string | null
  release: string
  tests: Record<string, ParsedTest[]>
  testFields: Record<string, string>[]
  environment: Record<string, string>[]
  duration: number
}


const TEST_FIELDS_LABELS = [
  'Test_Level',
  'Test_Type',
  'Testing_Tool_Type',
  'Framework',
] as const

const ENVIRONMENT_LABELS = [
  'AUT Env',
  'Browser',
  'DB',
  'Distribution',
  'OS',
] as const


function readAllureJsonFiles(dir: string): AllureTestResult[] {
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const fullPath = path.join(dir, f)
      try {
        return JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
      } catch {
        return null
      }
    })
    .filter(Boolean)
}


function getLabel(labels: AllureLabel[] | undefined, name: string): string | null {
  return labels?.find(l => l.name === name)?.value ?? null
}



function collectLabelGroup(
  labels: AllureLabel[] | undefined,
  allowed: readonly string[]
): Record<string, string>[] {
  if (!labels) return []

  const obj: Record<string, string> = {}

  for (const key of allowed) {
    const value = getLabel(labels, key)
    if (value) {
      obj[key] = value
    }
  }

  return Object.keys(obj).length ? [obj] : []
}


export function parseAllureResults(resultsDir: string): ParsedSuite[] {
  const results = readAllureJsonFiles(resultsDir)

  const suitesMap = new Map<string, ParsedSuite>()

  for (const test of results) {
    const labels = test.labels ?? []

    const suiteName = getLabel(labels, 'suiteName') ?? 'Unknown_Suite'
    const subSuite = getLabel(labels, 'subSuite') ?? 'Default'

    if (!suitesMap.has(suiteName)) {
      suitesMap.set(suiteName, {
        suite: suiteName,
        suiteId: getLabel(labels, 'suiteId'),
        backlogItemRef: getLabel(labels, 'backlogItemRef'),
        productAreaRefId: getLabel(labels, 'productAreaId'),
        release: getLabel(labels, 'release') ?? 'Default_Release',
        tests: {},
        testFields: collectLabelGroup(labels, TEST_FIELDS_LABELS),
        environment: collectLabelGroup(labels, ENVIRONMENT_LABELS),
        duration: 0,
      })
    }

    const suite = suitesMap.get(suiteName)!

    if (!suite.tests[subSuite]) {
      suite.tests[subSuite] = []
    }

    const duration =
      test.start && test.stop ? test.stop - test.start : undefined

    suite.tests[subSuite].push({
      name: test.name,
      status: test.status,
      duration,
      trace: test.statusDetails?.trace,
    })

    if (duration) {
      suite.duration += duration
    }
  }

  return Array.from(suitesMap.values())
}

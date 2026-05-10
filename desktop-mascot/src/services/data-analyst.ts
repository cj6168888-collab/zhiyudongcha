interface DataSet {
  headers: string[]
  rows: any[][]
  types: ('string' | 'number' | 'date' | 'boolean')[]
}

interface AnalysisResult {
  summary: {
    rowCount: number
    columnCount: number
    nullCount: number
    duplicateCount: number
  }
  columns: ColumnAnalysis[]
}

interface ColumnAnalysis {
  name: string
  type: string
  nullCount: number
  uniqueCount: number
  min?: number | string
  max?: number | string
  mean?: number
  median?: number
  mode?: any
  stdDev?: number
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area'
  title: string
  xAxis: string
  yAxis?: string
  data: { labels: string[]; values: number[] }[]
}

class DataAnalyst {
  private electronAPI: typeof window.electronAPI | null = null

  constructor() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      this.electronAPI = window.electronAPI
    }
  }

  async loadExcel(filePath: string): Promise<DataSet | null> {
    if (!this.electronAPI) return null

    try {
      const data = await (this.electronAPI as any).readExcel?.(filePath)
      if (!data?.sheets?.[0]) return null

      const sheet = data.sheets[0]
      return {
        headers: sheet.headers || sheet.data[0] || [],
        rows: sheet.headers ? sheet.data : sheet.data.slice(1),
        types: this.inferTypes(sheet.data),
      }
    } catch (error) {
      console.error('加载Excel失败:', error)
      return null
    }
  }

  async loadCSV(filePath: string): Promise<DataSet | null> {
    if (!this.electronAPI) return null

    try {
      const content = await (this.electronAPI as any).readFile?.(filePath)
      if (!content) return null

      const lines = content.split('\n').filter((l: string) => l.trim())
      const headers = this.parseCSVLine(lines[0])
      const rows = lines.slice(1).map((line: string) => this.parseCSVLine(line))

      return {
        headers,
        rows,
        types: this.inferTypes(rows),
      }
    } catch (error) {
      console.error('加载CSV失败:', error)
      return null
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())

    return result
  }

  private inferTypes(rows: any[][]): DataSet['types'] {
    if (rows.length === 0) return []

    const numCols = rows[0]?.length || 0
    const types: DataSet['types'] = []

    for (let col = 0; col < numCols; col++) {
      let isNumber = true
      let isDate = true

      for (const row of rows.slice(0, 100)) {
        const val = row[col]
        if (val === null || val === undefined || val === '') continue

        if (isNumber && isNaN(Number(val))) isNumber = false
        if (isDate && isNaN(Date.parse(String(val)))) isDate = false
      }

      if (isNumber) types.push('number')
      else if (isDate) types.push('date')
      else types.push('string')
    }

    return types
  }

  analyze(data: DataSet): AnalysisResult {
    const result: AnalysisResult = {
      summary: {
        rowCount: data.rows.length,
        columnCount: data.headers.length,
        nullCount: 0,
        duplicateCount: 0,
      },
      columns: [],
    }

    const rowStrings = new Set<string>()
    
    for (const row of data.rows) {
      const rowStr = JSON.stringify(row)
      if (rowStrings.has(rowStr)) {
        result.summary.duplicateCount++
      }
      rowStrings.add(rowStr)
    }

    for (let i = 0; i < data.headers.length; i++) {
      const values = data.rows.map(row => row[i])
      const colAnalysis = this.analyzeColumn(data.headers[i], values, data.types[i])
      result.summary.nullCount += colAnalysis.nullCount
      result.columns.push(colAnalysis)
    }

    return result
  }

  private analyzeColumn(name: string, values: any[], type: string): ColumnAnalysis {
    const analysis: ColumnAnalysis = {
      name,
      type,
      nullCount: 0,
      uniqueCount: 0,
    }

    const uniqueValues = new Set()
    const nonNullValues: any[] = []

    for (const val of values) {
      if (val === null || val === undefined || val === '') {
        analysis.nullCount++
      } else {
        uniqueValues.add(val)
        nonNullValues.push(val)
      }
    }

    analysis.uniqueCount = uniqueValues.size

    if (type === 'number') {
      const nums = nonNullValues.map(Number).filter(n => !isNaN(n))
      if (nums.length > 0) {
        analysis.min = Math.min(...nums)
        analysis.max = Math.max(...nums)
        analysis.mean = nums.reduce((a, b) => a + b, 0) / nums.length
        
        const sorted = [...nums].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        analysis.median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        
        const variance = nums.reduce((sum, n) => sum + Math.pow(n - analysis.mean!, 2), 0) / nums.length
        analysis.stdDev = Math.sqrt(variance)
      }
    }

    const frequency = new Map<any, number>()
    for (const val of nonNullValues) {
      frequency.set(val, (frequency.get(val) || 0) + 1)
    }
    let maxFreq = 0
    for (const [val, freq] of frequency) {
      if (freq > maxFreq) {
        maxFreq = freq
        analysis.mode = val
      }
    }

    return analysis
  }

  filter(data: DataSet, conditions: Array<{
    column: string
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'startsWith' | 'endsWith'
    value: any
  }>): DataSet {
    const filteredRows = data.rows.filter(row => {
      return conditions.every(cond => {
        const colIndex = data.headers.indexOf(cond.column)
        if (colIndex === -1) return true

        const cellValue = row[colIndex]
        const compareValue = cond.value

        switch (cond.operator) {
          case '=': return cellValue == compareValue
          case '!=': return cellValue != compareValue
          case '>': return Number(cellValue) > Number(compareValue)
          case '<': return Number(cellValue) < Number(compareValue)
          case '>=': return Number(cellValue) >= Number(compareValue)
          case '<=': return Number(cellValue) <= Number(compareValue)
          case 'contains': return String(cellValue).includes(String(compareValue))
          case 'startsWith': return String(cellValue).startsWith(String(compareValue))
          case 'endsWith': return String(cellValue).endsWith(String(compareValue))
          default: return true
        }
      })
    })

    return { ...data, rows: filteredRows }
  }

  sort(data: DataSet, column: string, ascending = true): DataSet {
    const colIndex = data.headers.indexOf(column)
    if (colIndex === -1) return data

    const sortedRows = [...data.rows].sort((a, b) => {
      const aVal = a[colIndex]
      const bVal = b[colIndex]

      if (data.types[colIndex] === 'number') {
        return ascending ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
      }

      const aStr = String(aVal)
      const bStr = String(bVal)
      return ascending ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })

    return { ...data, rows: sortedRows }
  }

  groupBy(data: DataSet, column: string, aggregations: Array<{
    column: string
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max'
  }>): DataSet {
    const colIndex = data.headers.indexOf(column)
    if (colIndex === -1) return data

    const groups = new Map<any, any[][]>()

    for (const row of data.rows) {
      const key = row[colIndex]
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(row)
    }

    const newHeaders = [column, ...aggregations.map(a => `${a.operation}(${a.column})`)]
    const newRows: any[][] = []

    for (const [key, rows] of groups) {
      const newRow: any[] = [key]

      for (const agg of aggregations) {
        const aggColIndex = data.headers.indexOf(agg.column)
        const values = rows.map(r => Number(r[aggColIndex])).filter(n => !isNaN(n))

        switch (agg.operation) {
          case 'sum': newRow.push(values.reduce((a, b) => a + b, 0)); break
          case 'avg': newRow.push(values.reduce((a, b) => a + b, 0) / values.length); break
          case 'count': newRow.push(values.length); break
          case 'min': newRow.push(Math.min(...values)); break
          case 'max': newRow.push(Math.max(...values)); break
        }
      }

      newRows.push(newRow)
    }

    return {
      headers: newHeaders,
      rows: newRows,
      types: newHeaders.map(() => 'number'),
    }
  }

  generateChart(data: DataSet, config: Partial<ChartConfig>): ChartConfig {
    const xIndex = data.headers.indexOf(config.xAxis || data.headers[0])
    const yIndex = config.yAxis ? data.headers.indexOf(config.yAxis) : 1

    const labels = data.rows.map(row => String(row[xIndex]))
    const values = data.rows.map(row => Number(row[yIndex]) || 0)

    return {
      type: config.type || 'bar',
      title: config.title || `${data.headers[yIndex]} by ${data.headers[xIndex]}`,
      xAxis: data.headers[xIndex],
      yAxis: data.headers[yIndex],
      data: [{ labels, values }],
    }
  }

  async saveExcel(data: DataSet, filePath: string): Promise<boolean> {
    if (!this.electronAPI) return false

    try {
      const result = await (this.electronAPI as any).writeExcel?.(filePath, {
        sheets: [{
          name: 'Sheet1',
          headers: data.headers,
          data: data.rows,
        }],
      })
      return result?.success || false
    } catch (error) {
      console.error('保存Excel失败:', error)
      return false
    }
  }

  exportToCSV(data: DataSet): string {
    const escapeCSV = (val: any) => {
      const str = String(val ?? '')
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const headerLine = data.headers.map(escapeCSV).join(',')
    const dataLines = data.rows.map(row => row.map(escapeCSV).join(','))

    return [headerLine, ...dataLines].join('\n')
  }

  cleanData(data: DataSet, options: {
    removeNulls?: boolean
    removeDuplicates?: boolean
    trimStrings?: boolean
    fillNulls?: Record<string, any>
  }): DataSet {
    let rows = [...data.rows]

    if (options.trimStrings) {
      rows = rows.map(row => row.map(cell => 
        typeof cell === 'string' ? cell.trim() : cell
      ))
    }

    if (options.fillNulls) {
      rows = rows.map(row => row.map((cell, i) => {
        if (cell === null || cell === undefined || cell === '') {
          const header = data.headers[i]
          return options.fillNulls![header] ?? cell
        }
        return cell
      }))
    }

    if (options.removeNulls) {
      rows = rows.filter(row => row.every(cell => 
        cell !== null && cell !== undefined && cell !== ''
      ))
    }

    if (options.removeDuplicates) {
      const seen = new Set<string>()
      rows = rows.filter(row => {
        const key = JSON.stringify(row)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    return { ...data, rows }
  }
}

export const dataAnalyst = new DataAnalyst()
export default dataAnalyst

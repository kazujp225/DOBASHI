/**
 * CSVエクスポートユーティリティ
 */

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  // ヘッダーを取得
  const headers = Object.keys(data[0])

  // CSVデータを生成
  const csvRows = []

  // ヘッダー行
  csvRows.push(headers.join(','))

  // データ行
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header]
      // 値をエスケープ
      const escaped = ('' + value).replace(/"/g, '""')
      // カンマや改行が含まれる場合はクォートで囲む
      return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped
    })
    csvRows.push(values.join(','))
  }

  // BOM付きCSV（Excel対応）
  const csvContent = '\uFEFF' + csvRows.join('\n')

  // Blobを作成
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

  // ダウンロード
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * ランキングデータをCSV用に変換
 */
export const formatRankingForCSV = (rankings: any[]) => {
  return rankings.map((item) => ({
    順位: item.rank,
    社長名: item.display_name,
    言及回数: item.total_mentions,
    出演動画数: item.total_videos,
    '平均Rate_total(%)': (item.avg_rate_total * 100).toFixed(2),
    '平均Rate_entity(%)': (item.avg_rate_entity * 100).toFixed(2),
  }))
}

/**
 * 動画統計データをCSV用に変換
 */
export const formatVideoStatsForCSV = (stats: any) => {
  return stats.tiger_stats.map((item: any) => ({
    順位: item.rank,
    社長名: item.display_name,
    言及数: item.mention_count,
    'Rate_total(%)': (item.rate_total * 100).toFixed(2),
    'Rate_entity(%)': (item.rate_entity * 100).toFixed(2),
  }))
}

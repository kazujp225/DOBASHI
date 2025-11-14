import { useEffect, useRef } from 'react'
import { Terminal, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  emoji?: string
}

interface LogViewerProps {
  logs: LogEntry[]
  title?: string
  maxHeight?: string
}

const LogViewer = ({ logs, title = "処理ログ", maxHeight = "400px" }: LogViewerProps) => {
  const logEndRef = useRef<HTMLDivElement>(null)

  // 新しいログが追加されたら自動スクロール
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'success':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'info':
      default:
        return 'text-blue-600 dark:text-blue-400'
    }
  }

  const getLevelIcon = (level: string) => {
    const iconClass = "w-4 h-4"
    switch (level.toLowerCase()) {
      case 'success':
        return <CheckCircle className={iconClass} />
      case 'error':
        return <XCircle className={iconClass} />
      case 'warning':
        return <AlertCircle className={iconClass} />
      case 'info':
      default:
        return <Info className={iconClass} />
    }
  }

  const getLevelBg = (level: string) => {
    switch (level.toLowerCase()) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    } catch {
      return timestamp
    }
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Terminal size={20} className="text-gray-700 dark:text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Terminal size={48} className="mx-auto mb-2 opacity-50" />
          <p>ログはまだありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center space-x-2 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <Terminal size={20} className="text-gray-700 dark:text-gray-300" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {logs.length} 件のログ
        </span>
      </div>

      <div
        className="overflow-y-auto p-4 space-y-2 font-mono text-sm bg-gray-900 dark:bg-black"
        style={{ maxHeight }}
      >
        {logs.map((log, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 p-3 rounded border ${getLevelBg(log.level)}`}
          >
            <div className={`mt-0.5 ${getLevelColor(log.level)}`}>
              {getLevelIcon(log.level)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {formatTime(log.timestamp)}
                </span>
                <span className={`text-xs font-semibold uppercase ${getLevelColor(log.level)}`}>
                  {log.level}
                </span>
              </div>
              <p className={`${getLevelColor(log.level)} break-words whitespace-pre-wrap`}>
                {log.message}
              </p>
            </div>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

export default LogViewer

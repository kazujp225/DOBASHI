import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { analysisApi } from '../services/api'
import { CheckCircle, XCircle, Loader, ArrowRight, Trash2, Play, Users, AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface ExtractedTiger {
  tiger_id: string
  display_name: string
  source: string
}

interface CollectionJob {
  id: string
  url: string
  videoId: string | null
  status: 'pending' | 'collecting' | 'extracting' | 'selecting' | 'analyzing' | 'completed' | 'error'
  message: string
  collectedComments?: number
  extractedTigers?: ExtractedTiger[]
  selectedTigerIds?: string[]
  unmatchedNames?: string[]
}

const Collection = () => {
  const [urls, setUrls] = useState('')
  const [jobs, setJobs] = useState<CollectionJob[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentJobIndex, setCurrentJobIndex] = useState<number | null>(null)
  const [selectingJobIndex, setSelectingJobIndex] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const abortRef = useRef(false)

  const extractVideoId = (url: string): string | null => {
    try {
      if (url.includes('youtube.com/watch?v=')) {
        return url.split('v=')[1].split('&')[0]
      } else if (url.includes('youtu.be/')) {
        return url.split('youtu.be/')[1].split('?')[0]
      }
      return null
    } catch {
      return null
    }
  }

  const collectMutation = useMutation({
    mutationFn: (params: { video_url: string }) => analysisApi.collect(params),
  })

  const extractMutation = useMutation({
    mutationFn: (videoId: string) => analysisApi.extractTigers(videoId),
  })

  const analyzeMutation = useMutation({
    mutationFn: (params: { video_id: string; tiger_ids: string[] }) => analysisApi.analyze(params),
  })

  const pollProgress = (videoId: string): Promise<{ status: string; collectedComments: number; message: string }> => {
    return new Promise((resolve) => {
      let retryCount = 0
      const maxRetries = 3

      const interval = setInterval(async () => {
        if (abortRef.current) {
          clearInterval(interval)
          resolve({ status: 'error', collectedComments: 0, message: '中断されました' })
          return
        }

        try {
          const status = await analysisApi.getCollectionStatus(videoId)
          retryCount = 0

          if (status.status === 'completed') {
            clearInterval(interval)
            queryClient.invalidateQueries({ queryKey: ['videos'] })
            resolve({
              status: 'completed',
              collectedComments: status.collected_comments || 0,
              message: `${status.collected_comments}件収集`
            })
          } else if (status.status === 'error') {
            clearInterval(interval)
            resolve({
              status: 'error',
              collectedComments: 0,
              message: status.message || 'エラー'
            })
          }
        } catch (error: any) {
          retryCount++
          if (retryCount >= maxRetries) {
            clearInterval(interval)
            if (error.response?.status === 404) {
              queryClient.invalidateQueries({ queryKey: ['videos'] })
              resolve({
                status: 'completed',
                collectedComments: 0,
                message: '完了'
              })
            } else {
              resolve({
                status: 'error',
                collectedComments: 0,
                message: '取得失敗'
              })
            }
          }
        }
      }, 2000)
    })
  }

  const runAnalysis = async (jobIndex: number, tigerIds: string[], collectedComments: number) => {
    const job = jobs[jobIndex]
    if (!job.videoId) return

    setJobs(prev => prev.map((j, idx) =>
      idx === jobIndex ? {
        ...j,
        status: 'analyzing',
        message: `${tigerIds.length}名で分析中...`,
        selectedTigerIds: tigerIds
      } : j
    ))

    try {
      await analyzeMutation.mutateAsync({
        video_id: job.videoId,
        tiger_ids: tigerIds
      })
      setJobs(prev => prev.map((j, idx) =>
        idx === jobIndex ? {
          ...j,
          status: 'completed',
          message: `${collectedComments}件 → ${tigerIds.length}名分析完了`
        } : j
      ))
    } catch (analyzeError) {
      setJobs(prev => prev.map((j, idx) =>
        idx === jobIndex ? {
          ...j,
          status: 'completed',
          message: `${collectedComments}件（分析エラー）`
        } : j
      ))
    }
  }

  const handleTigerSelection = async (jobIndex: number, selectedIds: string[]) => {
    const job = jobs[jobIndex]
    setSelectingJobIndex(null)
    await runAnalysis(jobIndex, selectedIds, job.collectedComments || 0)

    // 次のジョブを処理
    continueProcessing(jobIndex + 1)
  }

  const continueProcessing = async (startIndex: number) => {
    for (let i = startIndex; i < jobs.length; i++) {
      if (abortRef.current) break
      const job = jobs[i]
      if (!job.videoId || job.status !== 'pending') continue

      await processJob(i)

      // 選択待ちの場合は中断
      if (jobs[i]?.status === 'selecting') {
        return
      }
    }

    setIsProcessing(false)
    setCurrentJobIndex(null)
    queryClient.invalidateQueries({ queryKey: ['videos'] })
    queryClient.invalidateQueries({ queryKey: ['analyzedVideos'] })

    const completedCount = jobs.filter(j => j.status === 'completed').length
    if (completedCount > 0) {
      toast.success(`${completedCount}件の処理が完了しました`)
    }
  }

  const processJob = async (jobIndex: number) => {
    const job = jobs[jobIndex]
    if (!job.videoId) return

    setCurrentJobIndex(jobIndex)

    // 1. 収集フェーズ
    setJobs(prev => prev.map((j, idx) =>
      idx === jobIndex ? { ...j, status: 'collecting', message: '収集中...' } : j
    ))

    try {
      const data = await collectMutation.mutateAsync({ video_url: job.url })

      if (data.status === 'collecting' && job.videoId) {
        const result = await pollProgress(job.videoId)

        if (result.status === 'completed') {
          // 2. 虎自動抽出フェーズ
          setJobs(prev => prev.map((j, idx) =>
            idx === jobIndex ? { ...j, status: 'extracting', message: '出演虎を検出中...' } : j
          ))

          try {
            const extractResult = await extractMutation.mutateAsync(job.videoId)
            const extractedTigers = extractResult.tigers || []
            const unmatchedNames = extractResult.unmatched_names || []

            // 3分岐の判定
            if (extractedTigers.length === 0) {
              // 0人の場合
              setJobs(prev => prev.map((j, idx) =>
                idx === jobIndex ? {
                  ...j,
                  status: 'completed',
                  message: `${result.collectedComments}件（出演虎が検出できませんでした）`,
                  collectedComments: result.collectedComments,
                  extractedTigers: [],
                  unmatchedNames
                } : j
              ))
            } else if (extractedTigers.length <= 5) {
              // 5人以下 → そのまま分析（5人未満の場合は警告付き）
              const warningMsg = extractedTigers.length < 5
                ? `（${extractedTigers.length}人分しか検出できませんでした）`
                : ''

              setJobs(prev => prev.map((j, idx) =>
                idx === jobIndex ? {
                  ...j,
                  collectedComments: result.collectedComments,
                  extractedTigers,
                  unmatchedNames
                } : j
              ))

              await runAnalysis(jobIndex, extractedTigers.map(t => t.tiger_id), result.collectedComments)

              if (warningMsg) {
                setJobs(prev => prev.map((j, idx) =>
                  idx === jobIndex ? {
                    ...j,
                    message: j.message + warningMsg
                  } : j
                ))
              }
            } else {
              // 5人超過 → 選択UI表示
              setJobs(prev => prev.map((j, idx) =>
                idx === jobIndex ? {
                  ...j,
                  status: 'selecting',
                  message: `${extractedTigers.length}人の虎が検出されました。出演した虎を選択してください`,
                  collectedComments: result.collectedComments,
                  extractedTigers,
                  unmatchedNames
                } : j
              ))
              setSelectingJobIndex(jobIndex)
              return // 選択待ちで一旦停止
            }
          } catch (extractError) {
            setJobs(prev => prev.map((j, idx) =>
              idx === jobIndex ? {
                ...j,
                status: 'completed',
                message: `${result.collectedComments}件（虎抽出エラー）`,
                collectedComments: result.collectedComments
              } : j
            ))
          }
        } else {
          setJobs(prev => prev.map((j, idx) =>
            idx === jobIndex ? { ...j, status: 'error', message: result.message } : j
          ))
        }
      }
    } catch (error) {
      setJobs(prev => prev.map((j, idx) =>
        idx === jobIndex ? { ...j, status: 'error', message: '収集失敗' } : j
      ))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    if (urlList.length === 0) {
      toast.error('URLを入力してください')
      return
    }

    // ジョブリストを作成
    const newJobs: CollectionJob[] = urlList.map((url, index) => ({
      id: `job-${Date.now()}-${index}`,
      url,
      videoId: extractVideoId(url),
      status: 'pending' as const,
      message: '待機中'
    }))

    // 無効なURLをチェック
    const invalidJobs = newJobs.filter(job => !job.videoId)
    if (invalidJobs.length > 0) {
      invalidJobs.forEach(job => {
        job.status = 'error'
        job.message = '無効なURL'
      })
    }

    setJobs(newJobs)
    setIsProcessing(true)
    abortRef.current = false

    // 最初のジョブから処理開始
    for (let i = 0; i < newJobs.length; i++) {
      if (abortRef.current) break
      const job = newJobs[i]
      if (!job.videoId) continue

      await processJob(i)

      // 選択待ちの場合は中断（選択後にcontinueProcessingで再開）
      if (jobs[i]?.status === 'selecting') {
        return
      }

      // 次のジョブまで少し待機
      if (i < newJobs.length - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    if (!jobs.some(j => j.status === 'selecting')) {
      setIsProcessing(false)
      setCurrentJobIndex(null)
      queryClient.invalidateQueries({ queryKey: ['videos'] })
      queryClient.invalidateQueries({ queryKey: ['analyzedVideos'] })

      const completedCount = newJobs.filter(j => j.status === 'completed').length
      toast.success(`${completedCount}/${urlList.length}件の処理が完了しました`)
    }
  }

  const handleAbort = () => {
    abortRef.current = true
    toast('処理を中断しています...', { icon: 'ℹ️' })
  }

  const clearJobs = () => {
    setJobs([])
    setUrls('')
    setSelectingJobIndex(null)
  }

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const errorJobs = jobs.filter(j => j.status === 'error')
  const urlCount = urls.split('\n').filter(url => url.trim()).length

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">データ収集</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">YouTube動画のコメントを収集し、出演虎を自動検出して分析します</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">動画URL入力</h2>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="urls" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                YouTube動画URL（1行に1つ）
              </label>
              <textarea
                id="urls"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={`https://www.youtube.com/watch?v=xxx
https://www.youtube.com/watch?v=yyy
https://www.youtube.com/watch?v=zzz`}
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:bg-gray-100 font-mono text-sm"
                disabled={isProcessing}
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {urlCount}件のURL入力中
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!urls.trim() || isProcessing}
                className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-md"
              >
                {isProcessing ? <Loader size={20} className="animate-spin" /> : <Play size={20} />}
                <span>{isProcessing ? '処理中...' : '収集 & 自動分析'}</span>
              </button>

              {isProcessing && (
                <button
                  type="button"
                  onClick={handleAbort}
                  className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md"
                >
                  <XCircle size={20} />
                  <span>中断</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* 収集状況 */}
      {jobs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">処理状況</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                完了: {completedJobs.length} / エラー: {errorJobs.length} / 合計: {jobs.length}
              </p>
            </div>
            {!isProcessing && !selectingJobIndex && (
              <button
                onClick={clearJobs}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
                クリア
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
            {jobs.map((job, index) => (
              <div key={job.id}>
                <div
                  className={`px-6 py-3 flex items-center gap-4 ${
                    currentJobIndex === index ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                  } ${selectingJobIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  <div className="flex-shrink-0">
                    {job.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
                    )}
                    {(job.status === 'collecting' || job.status === 'extracting' || job.status === 'analyzing') && (
                      <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {job.status === 'selecting' && (
                      <Users className="w-5 h-5 text-amber-500" />
                    )}
                    {job.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {job.status === 'error' && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {job.videoId || '無効なURL'}
                    </p>
                    {job.extractedTigers && job.extractedTigers.length > 0 && job.status === 'completed' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                        <Users size={12} />
                        {job.selectedTigerIds?.length || job.extractedTigers.length}名の出演虎で分析
                      </p>
                    )}
                    {job.unmatchedNames && job.unmatchedNames.length > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        未登録: {job.unmatchedNames.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    <span className={`text-sm font-medium ${
                      job.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                      job.status === 'error' ? 'text-red-600 dark:text-red-400' :
                      job.status === 'selecting' ? 'text-amber-600 dark:text-amber-400' :
                      (job.status === 'collecting' || job.status === 'extracting' || job.status === 'analyzing') ? 'text-blue-600 dark:text-blue-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {job.message}
                    </span>
                  </div>
                </div>

                {/* 虎選択UI */}
                {selectingJobIndex === index && job.extractedTigers && (
                  <TigerSelector
                    tigers={job.extractedTigers}
                    onConfirm={(selectedIds) => handleTigerSelection(index, selectedIds)}
                    onCancel={() => {
                      setSelectingJobIndex(null)
                      setJobs(prev => prev.map((j, idx) =>
                        idx === index ? {
                          ...j,
                          status: 'completed',
                          message: `${job.collectedComments}件（虎選択をスキップ）`
                        } : j
                      ))
                      continueProcessing(index + 1)
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* 完了後のアクション */}
          {!isProcessing && !selectingJobIndex && completedJobs.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-3">
              {/* 未登録の社長がいる場合の警告 */}
              {jobs.some(j => j.unmatchedNames && j.unmatchedNames.length > 0) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      登録されていない社長が検出されました
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      社長マスタに登録してから再分析してください
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => navigate('/analysis')}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 shadow-md"
              >
                <span>動画分析ページへ移動</span>
                <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">使い方</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>YouTube動画のURLを入力してください（1行に1つ、複数可）</li>
          <li>「収集 & 自動分析」をクリックすると、以下が自動で実行されます：</li>
        </ol>
        <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li>コメントの収集</li>
          <li>動画の概要欄から出演虎を自動検出（5名を想定）</li>
          <li>5名を超える虎が検出された場合は選択画面が表示されます</li>
          <li>検出された虎で言及分析を実行</li>
        </ul>
        <p className="mt-3 text-sm text-blue-800 dark:text-blue-200">
          完了後、「動画分析」ページで結果を確認できます
        </p>
      </div>
    </div>
  )
}

// 虎選択コンポーネント
const TigerSelector = ({
  tigers,
  onConfirm,
  onCancel
}: {
  tigers: ExtractedTiger[]
  onConfirm: (selectedIds: string[]) => void
  onCancel: () => void
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(tigers.slice(0, 5).map(t => t.tiger_id)))

  const toggle = (tigerId: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(tigerId)) {
      newSelected.delete(tigerId)
    } else {
      newSelected.add(tigerId)
    }
    setSelected(newSelected)
  }

  return (
    <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-t border-blue-200 dark:border-blue-800">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
        出演した虎を選択してください（{selected.size}名選択中）
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {tigers.map(tiger => (
          <button
            key={tiger.tiger_id}
            onClick={() => toggle(tiger.tiger_id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              selected.has(tiger.tiger_id)
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-orange-400'
            }`}
          >
            {selected.has(tiger.tiger_id) && <Check size={14} />}
            {tiger.display_name}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(Array.from(selected))}
          disabled={selected.size === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
        >
          {selected.size}名で分析開始
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
        >
          スキップ
        </button>
      </div>
    </div>
  )
}

export default Collection

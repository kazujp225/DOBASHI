import { useState, useRef } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { tigersApi } from '../services/api'
import { Users, UserPlus, Edit, Trash2, Tag, Plus, X, FileText, MessageSquare, Scissors, Hash, Briefcase, Type, Languages, Globe, User, Search, Upload, Download, AlertCircle, CheckCircle } from 'lucide-react'
import Modal from '../components/Modal'
import TigerForm from '../components/TigerForm'
import toast from 'react-hot-toast'
import type { Tiger } from '../types'

interface CsvRow {
  tiger_id: string
  display_name: string
  full_name?: string
  category?: string
  description?: string
}

const Tigers = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingTiger, setEditingTiger] = useState<Tiger | null>(null)
  const [deletingTiger, setDeletingTiger] = useState<Tiger | null>(null)
  const [viewingAliasesTiger, setViewingAliasesTiger] = useState<Tiger | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [importData, setImportData] = useState<CsvRow[]>([])
  const [importMode, setImportMode] = useState<'add' | 'update' | 'replace'>('add')
  const [importPreview, setImportPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const queryClient = useQueryClient()

  const { data: tigers, isLoading } = useQuery({
    queryKey: ['tigers'],
    queryFn: tigersApi.getAll,
  })

  // 全社長の別名を取得
  const aliasQueries = useQueries({
    queries: (tigers || []).map((tiger) => ({
      queryKey: ['aliases', tiger.tiger_id],
      queryFn: () => tigersApi.getAliases(tiger.tiger_id),
      enabled: !!tigers,
      staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    })),
  })

  // 社長IDから別名を取得するヘルパー関数
  const getAliasesForTiger = (tigerId: string): string[] => {
    const index = tigers?.findIndex((t) => t.tiger_id === tigerId) ?? -1
    if (index === -1) return []
    const query = aliasQueries[index]
    if (!query?.data?.aliases) return []
    // 優先度順に上位5件の別名を返す
    return query.data.aliases
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)
      .map((a) => a.alias)
  }

  // 追加
  const addMutation = useMutation({
    mutationFn: tigersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tigers'] })
      setIsAddModalOpen(false)
      toast.success('社長を追加しました')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '追加に失敗しました')
    },
  })

  // 更新
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tiger> }) =>
      tigersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tigers'] })
      setEditingTiger(null)
      toast.success('社長情報を更新しました')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '更新に失敗しました')
    },
  })

  // 削除
  const deleteMutation = useMutation({
    mutationFn: tigersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tigers'] })
      setDeletingTiger(null)
      toast.success('社長を削除しました')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '削除に失敗しました')
    },
  })

  const handleAdd = async (data: Partial<Tiger> & { aliases?: Array<{ alias: string; type: string; priority: number }> }) => {
    const { aliases, ...tigerData } = data
    // まず社長を追加
    addMutation.mutate(tigerData as Omit<Tiger, 'tiger_id'>, {
      onSuccess: async () => {
        // 別名があれば追加
        if (aliases && aliases.length > 0 && data.tiger_id) {
          for (const alias of aliases) {
            try {
              await tigersApi.addAlias(data.tiger_id, alias)
            } catch (e) {
              console.error('別名追加エラー:', e)
            }
          }
          queryClient.invalidateQueries({ queryKey: ['aliases', data.tiger_id] })
        }
      }
    })
  }

  const handleUpdate = async (data: Partial<Tiger> & { aliases?: Array<{ alias: string; type: string; priority: number }> }) => {
    if (!editingTiger) return
    const { aliases, ...tigerData } = data
    updateMutation.mutate({ id: editingTiger.tiger_id, data: tigerData })
    // 注: 編集時の別名更新は別名管理モーダルで行う（ここでは更新しない）
  }

  const handleDelete = () => {
    if (!deletingTiger) return
    deleteMutation.mutate(deletingTiger.tiger_id)
  }

  // CSVインポート
  const importMutation = useMutation({
    mutationFn: ({ data, mode }: { data: CsvRow[]; mode: 'add' | 'update' | 'replace' }) =>
      tigersApi.importCsv(data, mode),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tigers'] })
      setIsImportModalOpen(false)
      setImportData([])
      setImportPreview(false)
      toast.success(result.message)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'インポートに失敗しました')
    },
  })

  // CSVファイルをパース
  const parseCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const rows: CsvRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: any = {}

      headers.forEach((header, index) => {
        // ヘッダー名を正規化
        const normalizedHeader = header.toLowerCase().replace(/\s+/g, '_')
        if (normalizedHeader === 'tiger_id' || normalizedHeader === '社長id') {
          row.tiger_id = values[index] || ''
        } else if (normalizedHeader === 'display_name' || normalizedHeader === '表示名') {
          row.display_name = values[index] || ''
        } else if (normalizedHeader === 'full_name' || normalizedHeader === '本名') {
          row.full_name = values[index] || ''
        } else if (normalizedHeader === 'category' || normalizedHeader === 'カテゴリ') {
          row.category = values[index] || 'other'
        } else if (normalizedHeader === 'description' || normalizedHeader === '説明') {
          row.description = values[index] || ''
        }
      })

      if (row.tiger_id && row.display_name) {
        rows.push(row as CsvRow)
      }
    }

    return rows
  }

  // ファイル選択時の処理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        toast.error('有効なデータがありません。CSVフォーマットを確認してください。')
        return
      }
      setImportData(parsed)
      setImportPreview(true)
    }
    reader.readAsText(file)
  }

  // CSVエクスポート
  const handleExport = async () => {
    try {
      const result = await tigersApi.exportCsv()
      const headers = ['tiger_id', 'display_name', 'full_name', 'category', 'description']
      const csvContent = [
        headers.join(','),
        ...result.data.map(row =>
          headers.map(h => `"${(row as any)[h] || ''}"`).join(',')
        )
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `社長マスタ_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSVをエクスポートしました')
    } catch (error) {
      toast.error('エクスポートに失敗しました')
    }
  }

  // インポート実行
  const handleImport = () => {
    if (importData.length === 0) return
    importMutation.mutate({ data: importData, mode: importMode })
  }

  const filteredTigers =
    tigers?.filter((tiger) => {
      const keyword = searchTerm.trim().toLowerCase()
      if (!keyword) return true
      return (
        tiger.tiger_id.toLowerCase().includes(keyword) ||
        tiger.display_name.toLowerCase().includes(keyword) ||
        (tiger.full_name?.toLowerCase() || '').includes(keyword) ||
        (tiger.description?.toLowerCase() || '').includes(keyword)
      )
    }) || []


  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">社長マスタ</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">登録されている社長の管理</p>
          </div>
        </div>

        {/* 検索とアクションボタン */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="名前で検索"
              className="pl-9 pr-3 py-2.5 w-full sm:w-56 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleExport}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm"
            >
              <Download size={18} />
              <span className="hidden sm:inline">CSV出力</span>
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">CSVインポート</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl hover:from-orange-700 hover:to-orange-600 shadow-lg shadow-orange-500/30 transition-all hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              <UserPlus size={18} />
              <span className="hidden sm:inline">社長を追加</span>
            </button>
          </div>
        </div>
      </div>

      {/* 社長一覧 */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">読み込み中...</p>
          </div>
        </div>
      ) : tigers && filteredTigers.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">社長一覧</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{filteredTigers.length}名</p>
          </div>
          {/* モバイル: カード表示 */}
          <div className="md:hidden p-4 space-y-3">
            {filteredTigers.map((tiger) => (
              <div
                key={tiger.tiger_id}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md">
                    <span className="text-xl font-bold text-white">
                      {tiger.display_name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {tiger.display_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {tiger.full_name || '-'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                      {tiger.tiger_id}
                    </p>
                  </div>
                </div>
                {/* 別名タグ */}
                {getAliasesForTiger(tiger.tiger_id).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {getAliasesForTiger(tiger.tiger_id).map((alias, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setViewingAliasesTiger(tiger)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium shadow-sm transition-all"
                  >
                    <Tag size={14} />
                    別名
                  </button>
                  <button
                    onClick={() => setEditingTiger(tiger)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 text-sm font-medium shadow-sm transition-all"
                  >
                    <Edit size={14} />
                    編集
                  </button>
                  <button
                    onClick={() => setDeletingTiger(tiger)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 text-sm font-medium shadow-sm transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* デスクトップ: テーブル表示 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">社長ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">表示名</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">本名</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">別名</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredTigers.map((tiger) => (
                  <tr key={tiger.tiger_id} className="group hover:bg-orange-50/50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                        {tiger.tiger_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                          <span className="text-lg font-bold text-white">
                            {tiger.display_name.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {tiger.display_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {tiger.full_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {getAliasesForTiger(tiger.tiger_id).length > 0 ? (
                          getAliasesForTiger(tiger.tiger_id).map((alias, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            >
                              {alias}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingAliasesTiger(tiger)}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                          title="別名一覧"
                        >
                          <Tag size={16} />
                        </button>
                        <button
                          onClick={() => setEditingTiger(tiger)}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
                          title="編集"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingTiger(tiger)}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tigers && tigers.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/20 mb-4">
              <Search size={32} className="text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">該当する社長が見つかりませんでした</p>
            <p className="text-gray-500 dark:text-gray-400">
              検索条件を変えるか、新しく社長を追加してください
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/20 mb-4">
              <Users size={40} className="text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">社長が登録されていません</p>
            <p className="text-gray-500 dark:text-gray-400">
              「社長を追加」ボタンから新しい社長を登録してください
            </p>
          </div>
        </div>
      )}

      {/* 情報カード */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Users size={20} className="text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">社長マスタについて</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              社長マスタは、コメント分析の基礎となるデータです。
              各社長の表示名、本名、呼称パターンなどを登録することで、
              コメント内の言及を正確に検出できます。
            </p>
          </div>
        </div>
      </div>

      {/* 追加モーダル */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="社長を追加"
      >
        <TigerForm
          onSubmit={handleAdd}
          onCancel={() => setIsAddModalOpen(false)}
          isLoading={addMutation.isPending}
        />
      </Modal>

      {/* 編集モーダル */}
      <Modal
        isOpen={!!editingTiger}
        onClose={() => setEditingTiger(null)}
        title="社長情報を編集"
      >
        {editingTiger && (
          <TigerForm
            tiger={editingTiger}
            onSubmit={handleUpdate}
            onCancel={() => setEditingTiger(null)}
            isLoading={updateMutation.isPending}
            existingAliases={(() => {
              const index = tigers?.findIndex((t) => t.tiger_id === editingTiger.tiger_id) ?? -1
              if (index === -1) return []
              const query = aliasQueries[index]
              return query?.data?.aliases || []
            })()}
          />
        )}
      </Modal>

      {/* 削除確認モーダル */}
      <Modal
        isOpen={!!deletingTiger}
        onClose={() => setDeletingTiger(null)}
        title="社長を削除"
      >
        {deletingTiger && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                以下の社長を削除してもよろしいですか？この操作は取り消せません。
              </p>
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-red-200">
                <p className="font-medium text-gray-900 dark:text-white">
                  {deletingTiger.display_name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{deletingTiger.full_name}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingTiger(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteMutation.isPending ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 別名一覧モーダル */}
      {viewingAliasesTiger && <AliasesModal tiger={viewingAliasesTiger} onClose={() => setViewingAliasesTiger(null)} />}

      {/* CSVインポートモーダル */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false)
          setImportData([])
          setImportPreview(false)
        }}
        title="CSVインポート"
      >
        <div className="space-y-6">
          {/* ファイル入力（非表示） */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!importPreview ? (
            <>
              {/* ファイルドロップエリア */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all"
              >
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-700 dark:text-gray-200 font-medium mb-2">
                  CSVファイルをクリックして選択
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  .csv形式のファイルをアップロード
                </p>
              </div>

              {/* CSVフォーマット説明 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-3">
                  <FileText size={18} />
                  CSVフォーマット
                </h4>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                  <p>必須カラム: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">tiger_id</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">display_name</code></p>
                  <p>任意カラム: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">full_name</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">category</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">description</code></p>
                  <p className="mt-2 font-medium">例:</p>
                  <pre className="bg-blue-100 dark:bg-blue-800 p-2 rounded text-xs overflow-x-auto">
{`tiger_id,display_name,full_name,category,description
hayashi_naohiro,林社長,林尚弘,regular,フランチャイズコンサルタント
iguchi_tomoaki,井口社長,井口智明,regular,株式会社クラウドワークス`}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* プレビュー */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle size={20} />
                  <span className="font-medium">{importData.length}件のデータを読み込みました</span>
                </div>
                <button
                  onClick={() => {
                    setImportData([])
                    setImportPreview(false)
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  やり直す
                </button>
              </div>

              {/* インポートモード選択 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">インポートモード</h4>
                <div className="space-y-2">
                  {[
                    { value: 'add' as const, label: '追加のみ', desc: '既存データと重複するIDはスキップ' },
                    { value: 'update' as const, label: '追加＋更新', desc: '既存データは更新、新規は追加' },
                    { value: 'replace' as const, label: '全置換', desc: '既存データを全て削除して入れ替え（注意）' },
                  ].map((mode) => (
                    <label
                      key={mode.value}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        importMode === mode.value
                          ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-400'
                          : 'bg-white dark:bg-gray-700 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        value={mode.value}
                        checked={importMode === mode.value}
                        onChange={() => setImportMode(mode.value)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">{mode.label}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{mode.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* プレビューテーブル */}
              <div className="max-h-60 overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">社長ID</th>
                      <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">表示名</th>
                      <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">本名</th>
                      <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">カテゴリ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {importData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200">{row.tiger_id}</td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{row.display_name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.full_name || '-'}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.category || 'other'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importData.length > 10 && (
                  <p className="text-center text-sm text-gray-500 py-2">
                    他 {importData.length - 10}件...
                  </p>
                )}
              </div>

              {importMode === 'replace' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">注意</p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        全置換モードでは、既存の社長データがすべて削除されます。この操作は取り消せません。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false)
                    setImportData([])
                    setImportPreview(false)
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  className="px-6 py-2 text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-lg hover:from-orange-700 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {importMutation.isPending ? 'インポート中...' : `${importData.length}件をインポート`}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

// 別名一覧を表示するモーダルコンポーネント
const AliasesModal = ({ tiger, onClose }: { tiger: Tiger; onClose: () => void }) => {
  const [newAlias, setNewAlias] = useState('')

  const queryClient = useQueryClient()

  const { data: aliasesData, isLoading } = useQuery({
    queryKey: ['aliases', tiger.tiger_id],
    queryFn: () => tigersApi.getAliases(tiger.tiger_id),
  })

  const addMutation = useMutation({
    mutationFn: (alias: { alias: string; type: string; priority: number }) =>
      tigersApi.addAlias(tiger.tiger_id, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases', tiger.tiger_id] })
      setNewAlias('')
      toast.success('別名を追加しました')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '追加に失敗しました')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (alias: string) => tigersApi.deleteAlias(tiger.tiger_id, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases', tiger.tiger_id] })
      toast.success('別名を削除しました')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '削除に失敗しました')
    },
  })

  const handleAddAlias = () => {
    if (!newAlias.trim()) {
      toast.error('別名を入力してください')
      return
    }

    addMutation.mutate({
      alias: newAlias.trim(),
      type: 'nickname',
      priority: 3,
    })
  }

  const getTypeInfo = (type: string): { label: string; icon: React.ComponentType<{ size?: number; className?: string }> } => {
    const types: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
      formal: { label: '正式名称', icon: FileText },
      casual: { label: '呼びかけ', icon: MessageSquare },
      short: { label: '短縮形', icon: Scissors },
      nickname: { label: 'ニックネーム', icon: Hash },
      fullname: { label: '本名', icon: User },
      business: { label: '事業関連', icon: Briefcase },
      hiragana: { label: 'ひらがな', icon: Type },
      katakana: { label: 'カタカナ', icon: Languages },
      variant: { label: '別表記', icon: Globe },
      description: { label: '説明的', icon: FileText },
      other: { label: 'その他', icon: Tag },
    }
    return types[type] || types.other
  }

  // タイプごとにグループ化し、フィルタリング
  const groupedAliases = aliasesData?.aliases
    .filter(alias => filterType === 'all' || alias.type === filterType)
    .reduce((acc, alias) => {
      if (!acc[alias.type]) {
        acc[alias.type] = []
      }
      acc[alias.type].push(alias)
      return acc
    }, {} as Record<string, typeof aliasesData.aliases>)

  // タイプごとの件数を計算
  const typeCounts = aliasesData?.aliases.reduce((acc, alias) => {
    acc[alias.type] = (acc[alias.type] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const filteredCount = groupedAliases ? Object.values(groupedAliases).flat().length : 0

  const aliasCount = aliasesData?.aliases?.length || 0

  return (
    <Modal isOpen={true} onClose={onClose} title={`${tiger.display_name} の別名管理`}>
      <div className="space-y-4">
        {/* 追加フォーム */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
            placeholder="新しい別名を入力"
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
          />
          <button
            onClick={handleAddAlias}
            disabled={addMutation.isPending || !newAlias.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <Plus size={16} />
            追加
          </button>
        </div>

        {/* 件数表示 */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {aliasCount}件の別名
          </span>
        </div>

        {/* 別名一覧 */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-gray-200 dark:border-gray-700 border-t-orange-500"></div>
            <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">読み込み中...</p>
          </div>
        ) : aliasesData?.aliases && aliasesData.aliases.length > 0 ? (
          <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto p-1">
            {aliasesData.aliases.map((alias, index) => (
              <span
                key={index}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
              >
                <span>{alias.alias}</span>
                <button
                  onClick={() => deleteMutation.mutate(alias.alias)}
                  disabled={deleteMutation.isPending}
                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors"
                  title="削除"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/10 mb-4">
              <Tag size={32} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">別名が登録されていません</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">上のフォームから新しい別名を追加してください</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default Tigers

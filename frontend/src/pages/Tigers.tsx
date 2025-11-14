import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tigersApi, getImageUrl } from '../services/api'
import { Users, UserPlus, Edit, Trash2, Tag, Plus, X, FileText, MessageSquare, Scissors, Hash, Briefcase, Type, Languages, Globe, User } from 'lucide-react'
import Modal from '../components/Modal'
import TigerForm from '../components/TigerForm'
import toast from 'react-hot-toast'
import type { Tiger } from '../types'

const Tigers = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingTiger, setEditingTiger] = useState<Tiger | null>(null)
  const [deletingTiger, setDeletingTiger] = useState<Tiger | null>(null)
  const [viewingAliasesTiger, setViewingAliasesTiger] = useState<Tiger | null>(null)

  const queryClient = useQueryClient()

  const { data: tigers, isLoading } = useQuery({
    queryKey: ['tigers'],
    queryFn: tigersApi.getAll,
  })

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

  const handleAdd = (data: Partial<Tiger>) => {
    addMutation.mutate(data as Omit<Tiger, 'tiger_id'>)
  }

  const handleUpdate = (data: Partial<Tiger>) => {
    if (!editingTiger) return
    updateMutation.mutate({ id: editingTiger.tiger_id, data })
  }

  const handleDelete = () => {
    if (!deletingTiger) return
    deleteMutation.mutate(deletingTiger.tiger_id)
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">社長マスタ</h1>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">登録されている社長の管理</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl hover:from-orange-700 hover:to-orange-600 shadow-lg shadow-orange-500/30 transition-all hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
        >
          <UserPlus size={18} />
          <span>社長を追加</span>
        </button>
      </div>

      {/* 社長一覧 */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">読み込み中...</p>
          </div>
        </div>
      ) : tigers && tigers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tigers.map((tiger) => (
            <div
              key={tiger.tiger_id}
              className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* カード背景グラデーション */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative p-6">
                {/* プロフィール画像 */}
                <div className="flex items-start gap-4 mb-4">
                  {getImageUrl(tiger.image_url) ? (
                    <img
                      src={getImageUrl(tiger.image_url)}
                      alt={tiger.display_name}
                      className="w-16 h-16 rounded-2xl object-cover shadow-md ring-2 ring-orange-100 dark:ring-orange-900/30"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md"
                    style={{ display: getImageUrl(tiger.image_url) ? 'none' : 'flex' }}
                  >
                    <span className="text-2xl font-bold text-white">
                      {tiger.display_name.charAt(0)}
                    </span>
                  </div>

                  {/* アクションボタン */}
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => setViewingAliasesTiger(tiger)}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                      title="別名一覧"
                    >
                      <Tag size={18} />
                    </button>
                    <button
                      onClick={() => setEditingTiger(tiger)}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
                      title="編集"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => setDeletingTiger(tiger)}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* 社長情報 */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {tiger.display_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {tiger.full_name}
                    </p>
                  </div>

                  {tiger.description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {tiger.description}
                    </p>
                  )}

                  {/* ID バッジ */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      ID: {tiger.tiger_id}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
    </div>
  )
}

// 別名一覧を表示するモーダルコンポーネント
const AliasesModal = ({ tiger, onClose }: { tiger: Tiger; onClose: () => void }) => {
  const [newAlias, setNewAlias] = useState('')
  const [newAliasType, setNewAliasType] = useState('nickname')
  const [newAliasPriority, setNewAliasPriority] = useState(3)
  const [filterType, setFilterType] = useState<string>('all')

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
      setNewAliasType('nickname')
      setNewAliasPriority(3)
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
      type: newAliasType,
      priority: newAliasPriority,
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

  return (
    <Modal isOpen={true} onClose={onClose} title={`${tiger.display_name} の別名管理`}>
      <div className="space-y-4">
        {/* 追加フォーム & フィルター */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
            placeholder="新しい別名"
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
          />
          <select
            value={newAliasType}
            onChange={(e) => setNewAliasType(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
          >
            <option value="formal">正式名称</option>
            <option value="casual">呼びかけ</option>
            <option value="short">短縮形</option>
            <option value="nickname">ニックネーム</option>
            <option value="business">事業関連</option>
            <option value="hiragana">ひらがな</option>
            <option value="katakana">カタカナ</option>
            <option value="variant">別表記</option>
            <option value="fullname">本名</option>
            <option value="other">その他</option>
          </select>
          <button
            onClick={handleAddAlias}
            disabled={addMutation.isPending || !newAlias.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <Plus size={16} />
            追加
          </button>
        </div>

        {/* フィルター */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {filteredCount}件の別名
          </span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">すべて</option>
            {Object.entries(typeCounts).map(([type, count]) => (
              <option key={type} value={type}>
                {getTypeInfo(type).label} ({count})
              </option>
            ))}
          </select>
        </div>

        {/* 別名一覧 */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-gray-200 dark:border-gray-700 border-t-orange-500"></div>
            <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">読み込み中...</p>
          </div>
        ) : aliasesData?.aliases && aliasesData.aliases.length > 0 ? (
          filteredCount > 0 ? (
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {Object.entries(groupedAliases || {}).map(([type, aliases]) => {
                const typeInfo = getTypeInfo(type)
                const IconComponent = typeInfo.icon
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2.5 sticky top-0 bg-white dark:bg-gray-900 py-1 z-10">
                      <div className="p-1 rounded bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20">
                        <IconComponent size={13} className="text-orange-600 dark:text-orange-400" />
                      </div>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        {typeInfo.label}
                      </span>
                      <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                        {aliases.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {aliases.map((alias, index) => (
                        <div
                          key={index}
                          className="group relative px-2.5 py-2 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 hover:-translate-y-0.5 transition-all duration-200"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {alias.alias}
                            </span>
                            <button
                              onClick={() => deleteMutation.mutate(alias.alias)}
                              disabled={deleteMutation.isPending}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-all"
                              title="削除"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                <Tag size={24} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">該当する別名がありません</p>
            </div>
          )
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

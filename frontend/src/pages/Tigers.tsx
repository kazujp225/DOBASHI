import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tigersApi } from '../services/api'
import { Users, UserPlus, Edit, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import TigerForm from '../components/TigerForm'
import toast from 'react-hot-toast'
import type { Tiger } from '../types'

const Tigers = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingTiger, setEditingTiger] = useState<Tiger | null>(null)
  const [deletingTiger, setDeletingTiger] = useState<Tiger | null>(null)

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">社長マスタ</h1>
          <p className="mt-2 text-gray-600">登録されている社長の一覧</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all transform hover:scale-105 shadow-md"
        >
          <UserPlus size={20} />
          <span>社長を追加</span>
        </button>
      </div>

      {/* 社長一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        ) : tigers && tigers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    表示名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    本名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    説明
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tigers.map((tiger) => (
                  <tr
                    key={tiger.tiger_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tiger.tiger_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {tiger.image_url ? (
                          <img
                            src={tiger.image_url}
                            alt={tiger.display_name}
                            className="h-10 w-10 rounded-full mr-3 object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mr-3">
                            <Users size={20} className="text-white" />
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900">
                          {tiger.display_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {tiger.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="max-w-xs truncate">
                        {tiger.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingTiger(tiger)}
                        className="text-orange-600 hover:text-orange-900 mr-4 transition-colors"
                      >
                        <Edit size={18} className="inline" />
                      </button>
                      <button
                        onClick={() => setDeletingTiger(tiger)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        <Trash2 size={18} className="inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 font-medium">社長が登録されていません</p>
            <p className="mt-2 text-sm text-gray-400">
              「社長を追加」ボタンから新しい社長を登録してください
            </p>
          </div>
        )}
      </div>

      {/* 情報 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 mb-2">📚 社長マスタについて</h3>
        <p className="text-sm text-blue-800">
          社長マスタは、コメント分析の基礎となるデータです。
          各社長の表示名、本名、呼称パターンなどを登録することで、
          コメント内の言及を正確に検出できます。
        </p>
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
              <div className="mt-3 p-3 bg-white rounded border border-red-200">
                <p className="font-medium text-gray-900">
                  {deletingTiger.display_name}
                </p>
                <p className="text-sm text-gray-600">{deletingTiger.full_name}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingTiger(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  )
}

export default Tigers

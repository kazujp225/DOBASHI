import { useQuery } from '@tanstack/react-query'
import { tigersApi } from '../services/api'
import { Users, UserPlus } from 'lucide-react'

const Tigers = () => {
  const { data: tigers, isLoading } = useQuery({
    queryKey: ['tigers'],
    queryFn: tigersApi.getAll,
  })

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">社長マスタ</h1>
          <p className="mt-2 text-gray-600">登録されている社長の一覧</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
          <UserPlus size={20} />
          <span>社長を追加</span>
        </button>
      </div>

      {/* 社長一覧 */}
      <div className="bg-white rounded-lg shadow">
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
                  <tr key={tiger.tiger_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tiger.tiger_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {tiger.image_url ? (
                          <img
                            src={tiger.image_url}
                            alt={tiger.display_name}
                            className="h-10 w-10 rounded-full mr-3"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                            <Users size={20} className="text-gray-600" />
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
                      <button className="text-orange-600 hover:text-orange-900 mr-4">
                        編集
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        削除
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
            <p className="text-gray-500">社長が登録されていません</p>
            <p className="mt-2 text-sm text-gray-400">
              「社長を追加」ボタンから新しい社長を登録してください
            </p>
          </div>
        )}
      </div>

      {/* 情報 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 mb-2">社長マスタについて</h3>
        <p className="text-sm text-blue-800">
          社長マスタは、コメント分析の基礎となるデータです。
          各社長の表示名、本名、呼称パターンなどを登録することで、
          コメント内の言及を正確に検出できます。
        </p>
      </div>
    </div>
  )
}

export default Tigers

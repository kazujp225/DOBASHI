import { useState, useEffect } from 'react'
import type { Tiger } from '../types'

interface TigerFormProps {
  tiger?: Tiger
  onSubmit: (data: Partial<Tiger>) => void
  onCancel: () => void
  isLoading?: boolean
}

const TigerForm = ({ tiger, onSubmit, onCancel, isLoading }: TigerFormProps) => {
  const [formData, setFormData] = useState({
    tiger_id: tiger?.tiger_id || '',
    display_name: tiger?.display_name || '',
    full_name: tiger?.full_name || '',
    description: tiger?.description || '',
    image_url: tiger?.image_url || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (tiger) {
      setFormData({
        tiger_id: tiger.tiger_id,
        display_name: tiger.display_name,
        full_name: tiger.full_name,
        description: tiger.description || '',
        image_url: tiger.image_url || '',
      })
    }
  }, [tiger])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.tiger_id.trim()) {
      newErrors.tiger_id = '社長IDは必須です'
    } else if (!/^[a-z0-9_]+$/.test(formData.tiger_id)) {
      newErrors.tiger_id = '社長IDは半角英小文字、数字、アンダースコアのみ使用できます'
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = '表示名は必須です'
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = '本名は必須です'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    onSubmit(formData)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // エラーをクリア
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 社長ID */}
      <div className="relative">
        <label htmlFor="tiger_id" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          社長ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="tiger_id"
          value={formData.tiger_id}
          onChange={(e) => handleChange('tiger_id', e.target.value)}
          disabled={!!tiger || isLoading}
          autoComplete="off"
          aria-invalid={!!errors.tiger_id}
          aria-describedby={errors.tiger_id ? "tiger_id-error" : undefined}
          className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed ${
            errors.tiger_id ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
          }`}
          placeholder="hayashi"
        />
        {errors.tiger_id && (
          <p id="tiger_id-error" className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
            <span className="inline-block w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
            {errors.tiger_id}
          </p>
        )}
        {!tiger && !errors.tiger_id && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            半角英小文字、数字、アンダースコアのみ使用可能
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 表示名 */}
        <div className="relative">
          <label htmlFor="display_name" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
            表示名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="display_name"
            value={formData.display_name}
            onChange={(e) => handleChange('display_name', e.target.value)}
            disabled={isLoading}
            autoComplete="off"
            aria-invalid={!!errors.display_name}
            aria-describedby={errors.display_name ? "display_name-error" : undefined}
            className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all ${
              errors.display_name ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
            placeholder="林社長"
          />
          {errors.display_name && (
            <p id="display_name-error" className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
              <span className="inline-block w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
              {errors.display_name}
            </p>
          )}
        </div>

        {/* 本名 */}
        <div className="relative">
          <label htmlFor="full_name" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
            本名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="full_name"
            value={formData.full_name}
            onChange={(e) => handleChange('full_name', e.target.value)}
            disabled={isLoading}
            autoComplete="name"
            aria-invalid={!!errors.full_name}
            aria-describedby={errors.full_name ? "full_name-error" : undefined}
            className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all ${
              errors.full_name ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
            placeholder="林修一"
          />
          {errors.full_name && (
            <p id="full_name-error" className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
              <span className="inline-block w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
              {errors.full_name}
            </p>
          )}
        </div>
      </div>

      {/* 説明 */}
      <div className="relative">
        <label htmlFor="description" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          説明
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          disabled={isLoading}
          rows={3}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 hover:border-gray-300 dark:hover:border-gray-500 transition-all resize-none"
          placeholder="フランチャイズコンサルタント"
        />
      </div>

      {/* 画像URL */}
      <div className="relative">
        <label htmlFor="image_url" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          画像URL
        </label>
        <input
          type="url"
          id="image_url"
          value={formData.image_url}
          onChange={(e) => handleChange('image_url', e.target.value)}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 hover:border-gray-300 dark:hover:border-gray-500 transition-all"
          placeholder="https://example.com/image.jpg"
        />
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            画像URLを入力すると、自動的にダウンロードしてキャッシュします
          </p>
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl hover:from-orange-700 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all"
        >
          {isLoading ? '処理中...' : tiger ? '更新' : '追加'}
        </button>
      </div>
    </form>
  )
}

export default TigerForm

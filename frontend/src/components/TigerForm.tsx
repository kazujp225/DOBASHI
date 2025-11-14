import { useState, useEffect } from 'react'
import { Tiger } from '../types'

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 社長ID */}
      <div>
        <label htmlFor="tiger_id" className="block text-sm font-medium text-gray-700 mb-1">
          社長ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="tiger_id"
          value={formData.tiger_id}
          onChange={(e) => handleChange('tiger_id', e.target.value)}
          disabled={!!tiger || isLoading}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
            errors.tiger_id ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="hayashi_fc"
        />
        {errors.tiger_id && (
          <p className="mt-1 text-sm text-red-500">{errors.tiger_id}</p>
        )}
        {!tiger && (
          <p className="mt-1 text-xs text-gray-500">
            例: hayashi_fc, iwai_restaurant, dobashi_real_estate
          </p>
        )}
      </div>

      {/* 表示名 */}
      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
          表示名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="display_name"
          value={formData.display_name}
          onChange={(e) => handleChange('display_name', e.target.value)}
          disabled={isLoading}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
            errors.display_name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="林社長"
        />
        {errors.display_name && (
          <p className="mt-1 text-sm text-red-500">{errors.display_name}</p>
        )}
      </div>

      {/* 本名 */}
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
          本名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="full_name"
          value={formData.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          disabled={isLoading}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
            errors.full_name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="林 修三"
        />
        {errors.full_name && (
          <p className="mt-1 text-sm text-red-500">{errors.full_name}</p>
        )}
      </div>

      {/* 説明 */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          説明
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          disabled={isLoading}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="FCチェーン経営のプロフェッショナル"
        />
      </div>

      {/* 画像URL */}
      <div>
        <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 mb-1">
          画像URL
        </label>
        <input
          type="url"
          id="image_url"
          value={formData.image_url}
          onChange={(e) => handleChange('image_url', e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="https://example.com/image.jpg"
        />
      </div>

      {/* ボタン */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '処理中...' : tiger ? '更新' : '追加'}
        </button>
      </div>
    </form>
  )
}

export default TigerForm

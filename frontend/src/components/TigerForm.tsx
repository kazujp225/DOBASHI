import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import type { Tiger } from '../types'

interface TigerFormProps {
  tiger?: Tiger
  onSubmit: (data: Partial<Tiger> & { aliases?: Array<{ alias: string; type: string; priority: number }> }) => void
  onCancel: () => void
  isLoading?: boolean
  existingAliases?: Array<{ alias: string; type: string; priority: number }>
}

interface AliasInput {
  alias: string
  type: string
}

const TigerForm = ({ tiger, onSubmit, onCancel, isLoading, existingAliases }: TigerFormProps) => {
  // 本名を苗字/名前に分割して初期化
  const parseFullName = (fullName: string | undefined) => {
    if (!fullName) return { lastName: '', firstName: '' }
    const parts = fullName.split(/\s+/)
    if (parts.length >= 2) {
      return { lastName: parts[0], firstName: parts.slice(1).join(' ') }
    }
    return { lastName: fullName, firstName: '' }
  }

  const [formData, setFormData] = useState({
    tiger_id: tiger?.tiger_id || '',
    display_name: tiger?.display_name || '',
    last_name_kanji: '',
    first_name_kanji: '',
    last_name_kana: '',
    first_name_kana: '',
    image_url: '',
  })

  const [aliases, setAliases] = useState<AliasInput[]>([])
  const [newAlias, setNewAlias] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (tiger) {
      const { lastName, firstName } = parseFullName(tiger.full_name)
      setFormData({
        tiger_id: tiger.tiger_id,
        display_name: tiger.display_name,
        last_name_kanji: lastName,
        first_name_kanji: firstName,
        last_name_kana: '',
        first_name_kana: '',
        image_url: '',
      })
    }
  }, [tiger])

  useEffect(() => {
    if (existingAliases) {
      setAliases(existingAliases.map(a => ({ alias: a.alias, type: a.type })))
    }
  }, [existingAliases])

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

    if (!formData.last_name_kanji.trim()) {
      newErrors.last_name_kanji = '苗字（漢字）は必須です'
    }

    if (!formData.first_name_kanji.trim()) {
      newErrors.first_name_kanji = '名前（漢字）は必須です'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    // 本名を結合
    const full_name = `${formData.last_name_kanji} ${formData.first_name_kanji}`.trim()

    // 別名配列を作成（priorityはtypeに応じて自動設定）
    const aliasesWithPriority = aliases.map((a, index) => ({
      alias: a.alias,
      type: a.type,
      priority: getTypePriority(a.type) + index,
    }))

    onSubmit({
      tiger_id: formData.tiger_id,
      display_name: formData.display_name,
      full_name,
      aliases: aliasesWithPriority,
    })
  }

  const getTypePriority = (type: string): number => {
    const priorities: Record<string, number> = {
      fullname: 1,
      formal: 2,
      nickname: 3,
      casual: 4,
      business: 5,
      hiragana: 6,
      katakana: 7,
      short: 8,
      other: 9,
    }
    return priorities[type] || 9
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleAddAlias = () => {
    if (!newAlias.trim()) return
    if (aliases.some(a => a.alias === newAlias.trim())) {
      return // 重複チェック
    }
    setAliases([...aliases, { alias: newAlias.trim(), type: 'nickname' }])
    setNewAlias('')
  }

  const handleRemoveAlias = (index: number) => {
    setAliases(aliases.filter((_, i) => i !== index))
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
          placeholder="dobashi_kazuki"
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
          placeholder="ドバシー社長"
        />
        {errors.display_name && (
          <p id="display_name-error" className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
            <span className="inline-block w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
            {errors.display_name}
          </p>
        )}
      </div>

      {/* 本名（漢字） */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          本名（漢字） <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <input
              type="text"
              value={formData.last_name_kanji}
              onChange={(e) => handleChange('last_name_kanji', e.target.value)}
              disabled={isLoading}
              autoComplete="family-name"
              aria-invalid={!!errors.last_name_kanji}
              className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all ${
                errors.last_name_kanji ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
              placeholder="苗字（例: 土橋）"
            />
            {errors.last_name_kanji && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.last_name_kanji}</p>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={formData.first_name_kanji}
              onChange={(e) => handleChange('first_name_kanji', e.target.value)}
              disabled={isLoading}
              autoComplete="given-name"
              aria-invalid={!!errors.first_name_kanji}
              className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all ${
                errors.first_name_kanji ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
              placeholder="名前（例: 和貴）"
            />
            {errors.first_name_kanji && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.first_name_kanji}</p>
            )}
          </div>
        </div>
      </div>

      {/* 本名（カタカナ） */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          本名（カタカナ）
          <span className="ml-2 text-xs font-normal text-gray-500">※ひらがなでも分析ヒットします</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={formData.last_name_kana}
            onChange={(e) => handleChange('last_name_kana', e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 hover:border-gray-300 dark:hover:border-gray-500 transition-all"
            placeholder="苗字（例: ドバシ）"
          />
          <input
            type="text"
            value={formData.first_name_kana}
            onChange={(e) => handleChange('first_name_kana', e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 hover:border-gray-300 dark:hover:border-gray-500 transition-all"
            placeholder="名前（例: カズキ）"
          />
        </div>
      </div>

      {/* 別名（その他の呼び名） */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
          その他の呼び名
          <span className="ml-2 text-xs font-normal text-gray-500">※コメント分析で使用されます</span>
        </label>

        {/* 入力フォーム */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddAlias()
              }
            }}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 hover:border-gray-300 dark:hover:border-gray-500 transition-all text-sm"
            placeholder="呼び名を入力（例: ドバシー、みだしー）"
          />
          <button
            type="button"
            onClick={handleAddAlias}
            disabled={isLoading || !newAlias.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-1.5"
          >
            <Plus size={16} />
            追加
          </button>
        </div>

        {/* 登録済み別名一覧 */}
        {aliases.length > 0 ? (
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-gray-100 dark:border-gray-700">
            {aliases.map((alias, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
              >
                <span>{alias.alias}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAlias(index)}
                  disabled={isLoading}
                  className="ml-1 p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              呼び名を追加すると、コメント分析で検出されます
            </p>
          </div>
        )}
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

import { useState, useRef } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { tigersApi } from '../services/api'
import { Users, UserPlus, Edit, Trash2, Tag, Plus, X, FileText, Search, Upload, Download, AlertCircle, CheckCircle } from 'lucide-react'
import Modal from '../components/Modal'
import TigerForm from '../components/TigerForm'
import toast from 'react-hot-toast'
import type { Tiger } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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

  const aliasQueries = useQueries({
    queries: (tigers || []).map((tiger) => ({
      queryKey: ['aliases', tiger.tiger_id],
      queryFn: () => tigersApi.getAliases(tiger.tiger_id),
      enabled: !!tigers,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const getAliasesForTiger = (tigerId: string): string[] => {
    const index = tigers?.findIndex((t) => t.tiger_id === tigerId) ?? -1
    if (index === -1) return []
    const query = aliasQueries[index]
    if (!query?.data?.aliases) return []
    return query.data.aliases
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)
      .map((a) => a.alias)
  }

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
    addMutation.mutate(tigerData as Omit<Tiger, 'tiger_id'>, {
      onSuccess: async () => {
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
  }

  const handleDelete = () => {
    if (!deletingTiger) return
    deleteMutation.mutate(deletingTiger.tiger_id)
  }

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

  const parseCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const rows: CsvRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: any = {}

      headers.forEach((header, index) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">社長マスタ</h1>
          <p className="text-muted-foreground">登録されている社長の管理</p>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="名前で検索"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">CSV出力</span>
            </Button>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">CSVインポート</span>
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">社長を追加</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tiger List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : tigers && filteredTigers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>社長一覧</CardTitle>
            <p className="text-sm text-muted-foreground">{filteredTigers.length}名</p>
          </CardHeader>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y">
            {filteredTigers.map((tiger) => (
              <div key={tiger.tiger_id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{tiger.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{tiger.display_name}</h3>
                    <p className="text-sm text-muted-foreground">{tiger.full_name || '-'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tiger.tiger_id}</p>
                  </div>
                </div>
                {getAliasesForTiger(tiger.tiger_id).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {getAliasesForTiger(tiger.tiger_id).map((alias, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{alias}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setViewingAliasesTiger(tiger)}>
                    <Tag className="h-4 w-4 mr-1" />別名
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingTiger(tiger)}>
                    <Edit className="h-4 w-4 mr-1" />編集
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeletingTiger(tiger)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>社長ID</TableHead>
                  <TableHead>表示名</TableHead>
                  <TableHead>本名</TableHead>
                  <TableHead>別名</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTigers.map((tiger) => (
                  <TableRow key={tiger.tiger_id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{tiger.tiger_id}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-sm">{tiger.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{tiger.display_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{tiger.full_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {getAliasesForTiger(tiger.tiger_id).length > 0 ? (
                          getAliasesForTiger(tiger.tiger_id).map((alias, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{alias}</Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewingAliasesTiger(tiger)}>
                          <Tag className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingTiger(tiger)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingTiger(tiger)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : tigers && tigers.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium mb-2">該当する社長が見つかりませんでした</p>
            <p className="text-sm text-muted-foreground">検索条件を変えるか、新しく社長を追加してください</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium mb-2">社長が登録されていません</p>
            <p className="text-sm text-muted-foreground">「社長を追加」ボタンから新しい社長を登録してください</p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium mb-2">社長マスタについて</h3>
              <p className="text-sm text-muted-foreground">
                社長マスタは、コメント分析の基礎となるデータです。
                各社長の表示名、本名、呼称パターンなどを登録することで、
                コメント内の言及を正確に検出できます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="社長を追加">
        <TigerForm
          onSubmit={handleAdd}
          onCancel={() => setIsAddModalOpen(false)}
          isLoading={addMutation.isPending}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingTiger} onClose={() => setEditingTiger(null)} title="社長情報を編集">
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTiger} onOpenChange={(open) => !open && setDeletingTiger(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>社長を削除</DialogTitle>
          </DialogHeader>
          {deletingTiger && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm">
                  以下の社長を削除してもよろしいですか？この操作は取り消せません。
                </p>
                <div className="mt-3 p-3 bg-background rounded border">
                  <p className="font-medium">{deletingTiger.display_name}</p>
                  <p className="text-sm text-muted-foreground">{deletingTiger.full_name}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletingTiger(null)} disabled={deleteMutation.isPending}>
                  キャンセル
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? '削除中...' : '削除'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Aliases Modal */}
      {viewingAliasesTiger && <AliasesModal tiger={viewingAliasesTiger} onClose={() => setViewingAliasesTiger(null)} />}

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsImportModalOpen(false)
          setImportData([])
          setImportPreview(false)
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>CSVインポート</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!importPreview ? (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  <Upload className="mx-auto text-muted-foreground mb-4" size={48} />
                  <p className="font-medium mb-2">CSVファイルをクリックして選択</p>
                  <p className="text-sm text-muted-foreground">.csv形式のファイルをアップロード</p>
                </div>

                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4" />
                      CSVフォーマット
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>必須カラム: <code className="bg-muted px-1 rounded">tiger_id</code>, <code className="bg-muted px-1 rounded">display_name</code></p>
                      <p>任意カラム: <code className="bg-muted px-1 rounded">full_name</code>, <code className="bg-muted px-1 rounded">category</code>, <code className="bg-muted px-1 rounded">description</code></p>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">{importData.length}件のデータを読み込みました</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setImportData([]); setImportPreview(false) }}>
                    やり直す
                  </Button>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">インポートモード</h4>
                  <div className="space-y-2">
                    {[
                      { value: 'add' as const, label: '追加のみ', desc: '既存データと重複するIDはスキップ' },
                      { value: 'update' as const, label: '追加＋更新', desc: '既存データは更新、新規は追加' },
                      { value: 'replace' as const, label: '全置換', desc: '既存データを全て削除して入れ替え（注意）' },
                    ].map((mode) => (
                      <label
                        key={mode.value}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                          importMode === mode.value ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
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
                          <p className="font-medium">{mode.label}</p>
                          <p className="text-sm text-muted-foreground">{mode.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="max-h-60 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>社長ID</TableHead>
                        <TableHead>表示名</TableHead>
                        <TableHead>本名</TableHead>
                        <TableHead>カテゴリ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{row.tiger_id}</TableCell>
                          <TableCell>{row.display_name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.full_name || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{row.category || 'other'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importData.length > 10 && (
                    <p className="text-center text-sm text-muted-foreground py-2">他 {importData.length - 10}件...</p>
                  )}
                </div>

                {importMode === 'replace' && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-destructive flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-medium text-destructive">注意</p>
                      <p className="text-sm">全置換モードでは、既存の社長データがすべて削除されます。</p>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setImportData([]); setImportPreview(false) }}>
                    キャンセル
                  </Button>
                  <Button onClick={handleImport} disabled={importMutation.isPending}>
                    {importMutation.isPending ? 'インポート中...' : `${importData.length}件をインポート`}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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
    addMutation.mutate({ alias: newAlias.trim(), type: 'nickname', priority: 3 })
  }

  const aliasCount = aliasesData?.aliases?.length || 0

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tiger.display_name} の別名管理</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
              placeholder="新しい別名を入力"
              className="flex-1"
            />
            <Button onClick={handleAddAlias} disabled={addMutation.isPending || !newAlias.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              追加
            </Button>
          </div>

          <div className="border-b pb-3">
            <span className="text-sm font-medium">{aliasCount}件の別名</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <Skeleton className="h-10 w-10 rounded-full mx-auto" />
              <p className="mt-3 text-sm text-muted-foreground">読み込み中...</p>
            </div>
          ) : aliasesData?.aliases && aliasesData.aliases.length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
              {aliasesData.aliases.map((alias, index) => (
                <Badge key={index} variant="secondary" className="pr-1">
                  {alias.alias}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1"
                    onClick={() => deleteMutation.mutate(alias.alias)}
                    disabled={deleteMutation.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="font-medium mb-1">別名が登録されていません</p>
              <p className="text-sm text-muted-foreground">上のフォームから新しい別名を追加してください</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default Tigers

"""社長マスタ管理モジュール"""
import json
import os
from typing import Dict, List, Optional


class TigerManager:
    """社長マスタとエイリアスを管理"""

    def __init__(
        self,
        tigers_file: str = 'data/tigers.json',
        aliases_file: str = 'data/aliases.json'
    ):
        """
        初期化

        Args:
            tigers_file: 社長マスタJSONファイルのパス
            aliases_file: エイリアス辞書JSONファイルのパス
        """
        self.tigers_file = tigers_file
        self.aliases_file = aliases_file

    def load_tigers(self) -> List[Dict]:
        """社長マスタを読み込み"""
        if not os.path.exists(self.tigers_file):
            return []

        with open(self.tigers_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_tigers(self, tigers: List[Dict]) -> bool:
        """
        社長マスタを保存

        Args:
            tigers: 社長情報のリスト

        Returns:
            成功したかどうか
        """
        try:
            # ディレクトリが存在しない場合は作成
            os.makedirs(os.path.dirname(self.tigers_file), exist_ok=True)

            with open(self.tigers_file, 'w', encoding='utf-8') as f:
                json.dump(tigers, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"Error saving tigers: {e}")
            return False

    def load_aliases(self) -> Dict:
        """エイリアス辞書を読み込み"""
        if not os.path.exists(self.aliases_file):
            return {}

        with open(self.aliases_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_aliases(self, aliases: Dict) -> bool:
        """
        エイリアス辞書を保存

        Args:
            aliases: エイリアス辞書

        Returns:
            成功したかどうか
        """
        try:
            os.makedirs(os.path.dirname(self.aliases_file), exist_ok=True)

            with open(self.aliases_file, 'w', encoding='utf-8') as f:
                json.dump(aliases, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"Error saving aliases: {e}")
            return False

    def get_tiger_by_id(self, tiger_id: str) -> Optional[Dict]:
        """
        IDで社長を取得

        Args:
            tiger_id: 社長ID

        Returns:
            社長情報、存在しない場合はNone
        """
        tigers = self.load_tigers()
        for tiger in tigers:
            if tiger['tiger_id'] == tiger_id:
                return tiger
        return None

    def add_tiger(
        self,
        tiger_id: str,
        display_name: str,
        full_name: str,
        description: str = "",
        image_url: str = ""
    ) -> bool:
        """
        新しい社長を追加

        Args:
            tiger_id: 社長ID（一意）
            display_name: 表示名
            full_name: 本名
            description: 説明
            image_url: 画像URL

        Returns:
            成功したかどうか
        """
        tigers = self.load_tigers()

        # IDの重複チェック
        if any(t['tiger_id'] == tiger_id for t in tigers):
            print(f"Tiger ID '{tiger_id}' already exists")
            return False

        # 新しい社長を追加
        new_tiger = {
            'tiger_id': tiger_id,
            'display_name': display_name,
            'full_name': full_name,
            'description': description,
            'image_url': image_url
        }
        tigers.append(new_tiger)

        # 保存
        if self.save_tigers(tigers):
            # エイリアスも初期化
            aliases = self.load_aliases()
            if tiger_id not in aliases:
                aliases[tiger_id] = []
                self.save_aliases(aliases)
            return True

        return False

    def update_tiger(
        self,
        tiger_id: str,
        display_name: Optional[str] = None,
        full_name: Optional[str] = None,
        description: Optional[str] = None,
        image_url: Optional[str] = None
    ) -> bool:
        """
        社長情報を更新

        Args:
            tiger_id: 社長ID
            display_name: 表示名（Noneの場合は変更なし）
            full_name: 本名（Noneの場合は変更なし）
            description: 説明（Noneの場合は変更なし）
            image_url: 画像URL（Noneの場合は変更なし）

        Returns:
            成功したかどうか
        """
        tigers = self.load_tigers()

        for tiger in tigers:
            if tiger['tiger_id'] == tiger_id:
                if display_name is not None:
                    tiger['display_name'] = display_name
                if full_name is not None:
                    tiger['full_name'] = full_name
                if description is not None:
                    tiger['description'] = description
                if image_url is not None:
                    tiger['image_url'] = image_url

                return self.save_tigers(tigers)

        print(f"Tiger ID '{tiger_id}' not found")
        return False

    def delete_tiger(self, tiger_id: str) -> bool:
        """
        社長を削除

        Args:
            tiger_id: 社長ID

        Returns:
            成功したかどうか
        """
        tigers = self.load_tigers()

        # 該当する社長を削除
        tigers = [t for t in tigers if t['tiger_id'] != tiger_id]

        if self.save_tigers(tigers):
            # エイリアスも削除
            aliases = self.load_aliases()
            if tiger_id in aliases:
                del aliases[tiger_id]
                self.save_aliases(aliases)
            return True

        return False

    def get_aliases(self, tiger_id: str) -> List[Dict]:
        """
        特定の社長のエイリアスを取得

        Args:
            tiger_id: 社長ID

        Returns:
            エイリアスのリスト
        """
        aliases = self.load_aliases()
        return aliases.get(tiger_id, [])

    def add_alias(
        self,
        tiger_id: str,
        alias: str,
        alias_type: str = "custom",
        priority: int = 5
    ) -> bool:
        """
        エイリアスを追加

        Args:
            tiger_id: 社長ID
            alias: エイリアス（呼称）
            alias_type: タイプ（formal, casual, nickname, etc.）
            priority: 優先度（1が最高）

        Returns:
            成功したかどうか
        """
        aliases = self.load_aliases()

        # 社長が存在するかチェック
        if self.get_tiger_by_id(tiger_id) is None:
            print(f"Tiger ID '{tiger_id}' not found")
            return False

        # エイリアスリストを取得または初期化
        if tiger_id not in aliases:
            aliases[tiger_id] = []

        # 重複チェック
        if any(a['alias'] == alias for a in aliases[tiger_id]):
            print(f"Alias '{alias}' already exists for tiger '{tiger_id}'")
            return False

        # エイリアスを追加
        aliases[tiger_id].append({
            'alias': alias,
            'type': alias_type,
            'priority': priority
        })

        # 優先度でソート
        aliases[tiger_id].sort(key=lambda x: x['priority'])

        return self.save_aliases(aliases)

    def update_alias(
        self,
        tiger_id: str,
        old_alias: str,
        new_alias: Optional[str] = None,
        alias_type: Optional[str] = None,
        priority: Optional[int] = None
    ) -> bool:
        """
        エイリアスを更新

        Args:
            tiger_id: 社長ID
            old_alias: 更新対象のエイリアス
            new_alias: 新しいエイリアス（Noneの場合は変更なし）
            alias_type: 新しいタイプ（Noneの場合は変更なし）
            priority: 新しい優先度（Noneの場合は変更なし）

        Returns:
            成功したかどうか
        """
        aliases = self.load_aliases()

        if tiger_id not in aliases:
            print(f"Tiger ID '{tiger_id}' not found")
            return False

        for alias_obj in aliases[tiger_id]:
            if alias_obj['alias'] == old_alias:
                if new_alias is not None:
                    alias_obj['alias'] = new_alias
                if alias_type is not None:
                    alias_obj['type'] = alias_type
                if priority is not None:
                    alias_obj['priority'] = priority

                # 優先度でソート
                aliases[tiger_id].sort(key=lambda x: x['priority'])

                return self.save_aliases(aliases)

        print(f"Alias '{old_alias}' not found for tiger '{tiger_id}'")
        return False

    def delete_alias(self, tiger_id: str, alias: str) -> bool:
        """
        エイリアスを削除

        Args:
            tiger_id: 社長ID
            alias: 削除するエイリアス

        Returns:
            成功したかどうか
        """
        aliases = self.load_aliases()

        if tiger_id not in aliases:
            print(f"Tiger ID '{tiger_id}' not found")
            return False

        # エイリアスを削除
        aliases[tiger_id] = [a for a in aliases[tiger_id] if a['alias'] != alias]

        return self.save_aliases(aliases)


# 使用例
if __name__ == '__main__':
    manager = TigerManager()

    # 社長を追加
    print("=== 社長を追加 ===")
    success = manager.add_tiger(
        tiger_id='test_tiger',
        display_name='テスト社長',
        full_name='テスト 太郎',
        description='テスト用の社長'
    )
    print(f"追加: {'成功' if success else '失敗'}")

    # エイリアスを追加
    print("\n=== エイリアスを追加 ===")
    manager.add_alias('test_tiger', 'テスト社長', 'formal', 1)
    manager.add_alias('test_tiger', 'テストさん', 'casual', 2)

    # 取得
    print("\n=== 社長情報を取得 ===")
    tiger = manager.get_tiger_by_id('test_tiger')
    print(tiger)

    print("\n=== エイリアスを取得 ===")
    aliases = manager.get_aliases('test_tiger')
    print(aliases)

    # 削除
    print("\n=== 社長を削除 ===")
    manager.delete_tiger('test_tiger')
    print("削除完了")
